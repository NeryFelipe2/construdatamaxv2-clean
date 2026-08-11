#!/usr/bin/env python3
"""
GERAR_IFC_LOD500.PY — Gerador IFC 2x3 / LOD 500 com geometria 3D real
Contrato 11481051 — SLNR Santos — SABESP
ConstruData - HydroNetwork — FCN Construções e Saneamento

LOD 500 = As-Built:
- Geometria 3D REAL: tubos ocos (SweptDiskSolid) + PVs cilindro (ExtrudedAreaSolid)
- Dimensões reais (DN, comprimento, profundidade, espessura parede)
- Localização georref (UTM SIRGAS 2000 Zone 23S)
- PropertySets: Dados_Tecnicos, Custo5D, SABESP_Hidraulica, Dados_PV
- Compatível: Navisworks, BIMVision, Solibri, IFC.js, xBIM

Gera:
1. IFC 2x3 com geometria 3D real (ifcopenshell SweptDiskSolid)
2. CSV de propriedades LOD 500
3. JSON com dados BIM completos 5D
"""

import json, math, os, csv
from pathlib import Path
from datetime import datetime

N_MANNING = {"PVC": 0.013, "PEAD": 0.011, "PE 80": 0.011, "PE 100": 0.011, "CONCRETO": 0.015}

CUSTOS_DEFAULT = {
    "tubo": {100:28.50,150:35.20,200:47.12,250:68.30,300:89.45,400:135.20,
             32:15.00,50:18.50,63:22.50,75:26.80,110:31.80,160:42.30,315:95.00},
    "pv_concreto":3078.00,"pi_plastico":1250.00,
    "escavacao_m3":30.77,"reaterro_m3":18.45,"repav_cbuq_m2":85.60,"largura_vala":0.80,
}

def _log(msg,lvl="INFO"): print(f"[IFC-LOD500] [{lvl}] {msg}")

def _calc_manning(dn_mm,decl_mm,material="PVC"):
    n=N_MANNING.get(material,0.013);D=dn_mm/1000;I=abs(decl_mm)/1000
    if I<=0 or D<=0: return {"v_ms":0,"q_ls":0,"tau_pa":0}
    A=math.pi*D*D/4;Rh=D/4;V=(1/n)*Rh**(2/3)*I**0.5;Q=V*A*1000;tau=9810*Rh*I
    return {"v_ms":round(V,4),"q_ls":round(Q,4),"tau_pa":round(tau,2)}

def _calc_custo(tr,pvs,custos=None):
    c=custos or CUSTOS_DEFAULT;dn=tr.get("dn_mm") or 200;ext=tr.get("ext_m") or 0
    p0=pvs.get(tr.get("pv_ini"),{});p1=pvs.get(tr.get("pv_fim"),{})
    prof=((p0.get("ct",0) or 0)-(p0.get("cf",0) or 0)+(p1.get("ct",0) or 0)-(p1.get("cf",0) or 0))/2
    if prof<=0:prof=1.5
    w=c.get("largura_vala",0.8);ve=ext*prof*w;vr=ve*0.85;ar=ext*w
    ct=c.get("tubo",{}).get(dn,47.12)*ext;ce=c.get("escavacao_m3",30.77)*ve
    cr=c.get("reaterro_m3",18.45)*vr;cp=c.get("repav_cbuq_m2",85.60)*ar;cpv=c.get("pv_concreto",3078.00)
    return {"custo_tubo":round(ct,2),"custo_escavacao":round(ce,2),"custo_reaterro":round(cr,2),
            "custo_reposicao":round(cp,2),"custo_pv":round(cpv,2),"custo_total":round(ct+ce+cr+cp+cpv,2)}

def _gerar_ifc_real(pvs,trechos,nucleo,ifc_path,custos=None):
    import ifcopenshell,ifcopenshell.api,ifcopenshell.api.owner.settings
    import numpy as np
    _log("Geometria 3D real (ifcopenshell SweptDiskSolid)...")
    model=ifcopenshell.api.run("project.create_file",version="IFC2X3")
    person=ifcopenshell.api.run("owner.add_person",model,given_name="Felipe",family_name="Nery")
    org=ifcopenshell.api.run("owner.add_organisation",model,identification="FCN",name="FCN Construções e Saneamento")
    user=ifcopenshell.api.run("owner.add_person_and_organisation",model,person=person,organisation=org)
    app=ifcopenshell.api.run("owner.add_application",model,application_developer=org,version="7.0",
        application_full_name="ConstruData - HydroNetwork",application_identifier="CDHN")
    ifcopenshell.api.owner.settings.get_user=lambda f:user
    ifcopenshell.api.owner.settings.get_application=lambda f:app
    project=ifcopenshell.api.run("root.create_entity",model,ifc_class="IfcProject",name=nucleo)
    ifcopenshell.api.run("unit.assign_unit",model,length={"is_metric":True,"raw":"METRE"})
    ctx=ifcopenshell.api.run("context.add_context",model,context_type="Model")
    body=ifcopenshell.api.run("context.add_context",model,context_type="Model",
        context_identifier="Body",target_view="MODEL_VIEW",parent=ctx)
    site=ifcopenshell.api.run("root.create_entity",model,ifc_class="IfcSite",name=nucleo)
    ifcopenshell.api.run("aggregate.assign_object",model,products=[site],relating_object=project)
    bldg=ifcopenshell.api.run("root.create_entity",model,ifc_class="IfcBuilding",name="Rede")
    ifcopenshell.api.run("aggregate.assign_object",model,products=[bldg],relating_object=site)
    st_esg=ifcopenshell.api.run("root.create_entity",model,ifc_class="IfcBuildingStorey",name="Esgoto")
    st_agua=ifcopenshell.api.run("root.create_entity",model,ifc_class="IfcBuildingStorey",name="Agua")
    ifcopenshell.api.run("aggregate.assign_object",model,products=[st_esg,st_agua],relating_object=bldg)
    xs=[p["x"] for p in pvs.values() if p.get("x")]
    ys=[p["y"] for p in pvs.values() if p.get("x")]
    if not xs: model.write(ifc_path);return ifc_path
    ox,oy=min(xs),min(ys)
    o2d=model.createIfcCartesianPoint((0.,0.));ax2d=model.createIfcAxis2Placement2D(o2d)
    o3d=model.createIfcCartesianPoint((0.,0.,0.));dzz=model.createIfcDirection((0.,0.,1.))
    dxx=model.createIfcDirection((1.,0.,0.));ax3d=model.createIfcAxis2Placement3D(o3d,dzz,dxx)
    np_=0
    for i,tr in enumerate(trechos):
        p0=pvs.get(tr.get("pv_ini"),{});p1=pvs.get(tr.get("pv_fim"),{})
        if not p0.get("x") or not p1.get("x"):continue
        dn=tr.get("dn_mm") or 200;mat=tr.get("material","PVC");ext=tr.get("ext_m") or 0;tipo=tr.get("tipo","esgoto")
        re=dn/2000.;ri=re*0.9
        x0,y0=p0["x"]-ox,p0["y"]-oy;x1,y1=p1["x"]-ox,p1["y"]-oy
        z0=float(p0.get("cf") or p0.get("ctf") or -1.5);z1=float(p1.get("cf") or p1.get("ctf") or -1.5)
        pipe=ifcopenshell.api.run("root.create_entity",model,ifc_class="IfcFlowSegment",
            name=f"T{i+1:03d}_{tr.get('pv_ini','?')}_{tr.get('pv_fim','?')}")
        m=np.eye(4);m[0][3]=x0;m[1][3]=y0;m[2][3]=z0
        ifcopenshell.api.run("geometry.edit_object_placement",model,product=pipe,matrix=m)
        ddx,ddy,ddz=x1-x0,y1-y0,z1-z0
        pt1=model.createIfcCartesianPoint((0.,0.,0.));pt2=model.createIfcCartesianPoint((float(ddx),float(ddy),float(ddz)))
        swept=model.createIfcSweptDiskSolid(model.createIfcPolyline([pt1,pt2]),float(re),float(ri))
        sr=model.createIfcShapeRepresentation(body,"Body","SweptSolid",[swept])
        pipe.Representation=model.createIfcProductDefinitionShape(None,None,[sr])
        storey=st_agua if tipo=='agua' else st_esg
        ifcopenshell.api.run("spatial.assign_container",model,products=[pipe],relating_structure=storey)
        decl=tr.get("decl_mm") or 0;hyd=_calc_manning(dn,decl,mat);custo=_calc_custo(tr,pvs,custos)
        ps1=ifcopenshell.api.run("pset.add_pset",model,product=pipe,name="Dados_Tecnicos")
        ifcopenshell.api.run("pset.edit_pset",model,pset=ps1,properties={
            "PV_Montante":str(tr.get("pv_ini","")),"PV_Jusante":str(tr.get("pv_fim","")),
            "DN_mm":float(dn),"Material":mat,"Extensao_m":float(ext),"Declividade_permil":float(decl),
            "Tipo":tipo.upper(),"CT_Montante":float(p0.get("ct") or 0),"CF_Montante":float(z0),
            "CT_Jusante":float(p1.get("ct") or 0),"CF_Jusante":float(z1)})
        ps2=ifcopenshell.api.run("pset.add_pset",model,product=pipe,name="SABESP_Hidraulica")
        ifcopenshell.api.run("pset.edit_pset",model,pset=ps2,properties={
            "Velocidade_ms":hyd["v_ms"],"Vazao_ls":hyd["q_ls"],"TensaoTrativa_Pa":hyd["tau_pa"],
            "Manning_n":N_MANNING.get(mat,0.013)})
        ps3=ifcopenshell.api.run("pset.add_pset",model,product=pipe,name="Custo5D")
        ifcopenshell.api.run("pset.edit_pset",model,pset=ps3,properties={
            "Custo_Tubo_RS":custo["custo_tubo"],"Custo_Escavacao_RS":custo["custo_escavacao"],
            "Custo_Reaterro_RS":custo["custo_reaterro"],"Custo_Reposicao_RS":custo["custo_reposicao"],
            "Custo_PV_RS":custo["custo_pv"],"Custo_Total_RS":custo["custo_total"]})
        np_+=1
    nv=0
    for nome,pv in pvs.items():
        if not pv.get("x"):continue
        ct=pv.get("ct") or 0;cf=pv.get("cf") or pv.get("ctf") or 0
        if cf==0:cf=ct-1.5 if ct else -1.5
        prof=ct-cf if ct and cf else 1.5
        if prof<=0:prof=1.5
        tipo=pv.get("tipo","esgoto");is_pv=nome.upper().startswith(("PV","P.V."))
        raio=0.60 if is_pv else 0.30
        elem=ifcopenshell.api.run("root.create_entity",model,ifc_class="IfcBuildingElementProxy",name=nome)
        m=np.eye(4);m[0][3]=pv["x"]-ox;m[1][3]=pv["y"]-oy;m[2][3]=float(cf) if cf!=0 else -1.5
        ifcopenshell.api.run("geometry.edit_object_placement",model,product=elem,matrix=m)
        circle=model.createIfcCircleProfileDef("AREA",None,ax2d,float(raio))
        solid=model.createIfcExtrudedAreaSolid(circle,ax3d,dzz,float(prof))
        sr=model.createIfcShapeRepresentation(body,"Body","SweptSolid",[solid])
        elem.Representation=model.createIfcProductDefinitionShape(None,None,[sr])
        storey=st_agua if tipo=='agua' else st_esg
        ifcopenshell.api.run("spatial.assign_container",model,products=[elem],relating_structure=storey)
        ps=ifcopenshell.api.run("pset.add_pset",model,product=elem,name="Dados_PV")
        ifcopenshell.api.run("pset.edit_pset",model,pset=ps,properties={
            "Nome":nome,"Tipo":"PV" if is_pv else "PI","Cota_Terreno_m":float(ct),
            "Cota_Fundo_m":float(cf),"Profundidade_m":float(prof),"Diametro_mm":float(raio*2000),
            "Material":pv.get("material_pv","CONCRETO"),"Coordenada_E":float(pv["x"]),"Coordenada_N":float(pv["y"])})
        nv+=1
    model.write(ifc_path)
    _log(f"IFC 3D: {os.path.getsize(ifc_path)/1024:.0f}KB | {np_} tubos SweptDiskSolid + {nv} PVs ExtrudedAreaSolid")
    v=ifcopenshell.open(ifc_path)
    assert len(v.by_type("IfcFlowSegment"))==np_
    assert len(v.by_type("IfcBuildingElementProxy"))==nv
    _log(f"Validação OK")
    return ifc_path

def gerar_ifc_lod500(pvs,trechos,nucleo,out_dir,custos=None):
    out=Path(out_dir);out.mkdir(parents=True,exist_ok=True)
    sn=nucleo.upper().replace(" ","_").replace("-","_");paths=[]
    ifc_path=str(out/f"LOD500_{sn}.ifc")
    try:
        _gerar_ifc_real(pvs,trechos,nucleo,ifc_path,custos);paths.append(ifc_path)
    except ImportError:_log("ifcopenshell não disponível","WARN")
    except Exception as e:_log(f"Erro IFC: {e}","ERROR");import traceback;traceback.print_exc()
    csv_path=str(out/f"LOD500_{sn}.csv")
    rows=[]
    for i,tr in enumerate(trechos):
        p0=pvs.get(tr.get("pv_ini"),{});p1=pvs.get(tr.get("pv_fim"),{})
        dn=tr.get("dn_mm") or 200;mat=tr.get("material","PVC");decl=tr.get("decl_mm") or 0
        hyd=_calc_manning(dn,decl,mat);custo=_calc_custo(tr,pvs,custos)
        rows.append({"NS":i+1,"PV_Mont":tr.get("pv_ini",""),"PV_Jus":tr.get("pv_fim",""),
            "Tipo":tr.get("tipo","esgoto").upper(),"DN_mm":dn,"Material":mat,
            "Ext_m":tr.get("ext_m",0),"Decl_permil":decl,
            "CT_Mont":p0.get("ct",0),"CF_Mont":p0.get("cf",0),
            "CT_Jus":p1.get("ct",0),"CF_Jus":p1.get("cf",0),
            "V_ms":hyd["v_ms"],"Q_ls":hyd["q_ls"],"Tau_Pa":hyd["tau_pa"],
            "Custo_Total":custo["custo_total"]})
    with open(csv_path,"w",newline="",encoding="utf-8-sig") as f:
        if rows:w=csv.DictWriter(f,fieldnames=rows[0].keys(),delimiter=";");w.writeheader();w.writerows(rows)
    paths.append(csv_path)
    json_path=str(out/f"BIM_LOD500_{sn}.json")
    bim={"meta":{"plataforma":"ConstruData - HydroNetwork","versao":"7.0","nucleo":nucleo,
        "data":datetime.now().isoformat(),"empresa":"FCN Construções e Saneamento","lod":500},
        "pvs":{n:{"E":p.get("x"),"N":p.get("y"),"ct":p.get("ct"),"cf":p.get("cf")} for n,p in pvs.items()},
        "trechos":[{"ns":i+1,"pv_ini":t.get("pv_ini"),"pv_fim":t.get("pv_fim"),"dn":t.get("dn_mm"),
            "ext":t.get("ext_m"),"material":t.get("material"),"custo":_calc_custo(t,pvs,custos)} for i,t in enumerate(trechos)]}
    with open(json_path,"w",encoding="utf-8") as f:json.dump(bim,f,indent=2,ensure_ascii=False)
    paths.append(json_path)
    _log(f"LOD 500 completo: {len(paths)} arquivos | IFC 3D real + CSV + JSON")
    return paths
