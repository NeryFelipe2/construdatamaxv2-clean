;;; =====================================================================
;;; EXTRAIR_PIPE_NETWORK.LSP
;;; ConstruData SABESP v5.0 — Extrator de Pipe Network Civil 3D
;;; Roda via accoreconsole (headless) com Object Enabler
;;;
;;; Extrai PVs (Structures) e Tubos (Pipes) de DWG Civil 3D
;;; e salva em CSV para leitura pelo pipeline Python.
;;;
;;; USO (via accoreconsole):
;;;   (load "extrair_pipe_network.lsp")
;;;   (c:EXTRAI_REDE_CSV "C:/tmp/output_dir/")
;;;
;;; Autor: Felipe Nery — FCN / DGS Engenharia
;;; =====================================================================

(vl-load-com)

;;; ── Utilitarios ──────────────────────────────────────────────────────

(defun _safe-get (obj prop / val)
  "Tenta ler propriedade COM. Retorna nil se falhar."
  (vl-catch-all-apply
    '(lambda ()
      (setq val (vlax-get-property obj prop))
      val
    )
  )
  (if (vl-catch-all-error-p val) nil val)
)

(defun _safe-get-nested (obj prop1 prop2 / inner val)
  "Tenta ler propriedade aninhada (ex: StartStructure.Name)."
  (setq inner (_safe-get obj prop1))
  (if inner
    (_safe-get inner prop2)
    nil
  )
)

(defun _num-to-str (val decimais / result)
  "Converte numero para string com decimais fixos. Retorna '0' se nil."
  (if val
    (rtos val 2 decimais)
    "0"
  )
)

(defun _escape-csv (str)
  "Escapa string para CSV (aspas duplas se contem virgula/aspas)."
  (if (or (vl-string-search "," str)
          (vl-string-search "\"" str)
          (vl-string-search "\n" str))
    (strcat "\"" (vl-string-subst "\"\"" "\"" str) "\"")
    str
  )
)

;;; ── Extrator Principal ───────────────────────────────────────────────

(defun c:EXTRAI_REDE_CSV (output_dir / doc msp obj objname
                           pvs_file tubos_file textos_file
                           n_structs n_pipes n_texts
                           nome x y z rim sump diam
                           len slope start_name end_name
                           pos_var pos_arr
                           bim_ok txt layer)

  (princ "\n[EXTRAI] Iniciando extracao de Pipe Network...")

  ;; Garantir que output_dir termina com /
  (if (not (= (substr output_dir (strlen output_dir) 1) "/"))
    (setq output_dir (strcat output_dir "/"))
  )

  ;; Abrir arquivos de saida
  (setq pvs_file (open (strcat output_dir "PVS_EXTRAIDOS.csv") "w"))
  (setq tubos_file (open (strcat output_dir "TUBOS_EXTRAIDOS.csv") "w"))
  (setq textos_file (open (strcat output_dir "TEXTOS_EXTRAIDOS.csv") "w"))

  (if (not pvs_file)
    (progn
      (princ (strcat "\n[EXTRAI] ERRO: Nao conseguiu criar arquivo em " output_dir))
      (exit)
    )
  )

  ;; Headers CSV
  (write-line "NOME,X,Y,Z,CT,CF,PROF,DIAMETRO,TIPO" pvs_file)
  (write-line "NOME,PV_INI,PV_FIM,DN_MM,EXT_M,DECL,MAT,INV_INI,INV_FIM" tubos_file)
  (write-line "LAYER,X,Y,TEXTO" textos_file)

  ;; Obter documento e ModelSpace
  (setq doc (vla-get-ActiveDocument (vlax-get-acad-object)))
  (setq msp (vla-get-ModelSpace doc))

  (princ (strcat "\n[EXTRAI] ModelSpace: " (itoa (vla-get-Count msp)) " entidades"))

  (setq n_structs 0)
  (setq n_pipes 0)
  (setq n_texts 0)
  (setq bim_ok nil)

  ;; ── CAMADA 1: Tentar ler propriedades BIM dos objetos AeccDb ──────

  (princ "\n[EXTRAI] Camada 1: Tentando propriedades BIM via vlax-get-property...")

  (vlax-for obj msp
    (setq objname (vl-catch-all-apply 'vla-get-ObjectName (list obj)))
    (if (vl-catch-all-error-p objname)
      (setq objname "UNKNOWN")
    )

    ;; ── Structures (PVs / Caixas) ──
    (if (and (vl-string-search "Structure" objname)
             (not (vl-string-search "Label" objname))
             (not (vl-string-search "Style" objname)))
      (progn
        (setq nome (_safe-get obj 'Name))
        (if (not nome) (setq nome (strcat "PV_" (itoa n_structs))))

        ;; Coordenadas - tentar Position, Location, Origin
        (setq x 0 y 0 z 0)
        (setq pos_var (_safe-get obj 'Position))
        (if (not pos_var) (setq pos_var (_safe-get obj 'Location)))
        (if (not pos_var) (setq pos_var (_safe-get obj 'Origin)))
        (if pos_var
          (progn
            (if (= (type pos_var) 'VARIANT)
              (progn
                (setq pos_arr (vlax-variant-value pos_var))
                (setq x (vlax-safearray-get-element pos_arr 0))
                (setq y (vlax-safearray-get-element pos_arr 1))
                (if (> (vlax-safearray-get-u-bound pos_arr 1) 1)
                  (setq z (vlax-safearray-get-element pos_arr 2))
                )
              )
              (if (listp pos_var)
                (progn
                  (setq x (car pos_var))
                  (setq y (cadr pos_var))
                  (if (caddr pos_var) (setq z (caddr pos_var)))
                )
              )
            )
          )
        )
        ;; Fallback: InsertionPoint
        (if (and (= x 0) (= y 0))
          (progn
            (setq pos_var (_safe-get obj 'InsertionPoint))
            (if pos_var
              (progn
                (setq pos_arr (vlax-variant-value pos_var))
                (setq x (vlax-safearray-get-element pos_arr 0))
                (setq y (vlax-safearray-get-element pos_arr 1))
              )
            )
          )
        )

        ;; Cotas BIM
        (setq rim (_safe-get obj 'RimElevation))
        (setq sump (_safe-get obj 'SumpElevation))
        (if (not rim) (setq rim (_safe-get obj 'SurfaceElevation)))
        (if (not sump) (setq sump (_safe-get obj 'InvertElevation)))

        ;; Diametro
        (setq diam (_safe-get obj 'InnerDiameterOrWidth))
        (if (not diam) (setq diam (_safe-get obj 'Diameter)))

        ;; Se conseguiu ler rim ou sump, BIM funciona
        (if (or rim sump) (setq bim_ok T))

        ;; Escrever CSV
        (write-line
          (strcat
            (_escape-csv (if nome nome "?")) ","
            (_num-to-str x 3) ","
            (_num-to-str y 3) ","
            (_num-to-str z 3) ","
            (_num-to-str rim 4) ","
            (_num-to-str sump 4) ","
            (_num-to-str (if (and rim sump) (- rim sump) nil) 3) ","
            (_num-to-str (if diam (* diam 1000) nil) 0) ","
            objname
          )
          pvs_file
        )

        (setq n_structs (1+ n_structs))
        (princ (strcat "\n[EXTRAI]   Structure: " (if nome nome "?")
                       " CT=" (_num-to-str rim 3)
                       " CF=" (_num-to-str sump 3)))
      )
    )

    ;; ── Pipes (Tubos) ──
    (if (and (vl-string-search "Pipe" objname)
             (not (vl-string-search "Network" objname))
             (not (vl-string-search "Label" objname))
             (not (vl-string-search "Style" objname))
             (not (vl-string-search "Rule" objname)))
      (progn
        (setq nome (_safe-get obj 'Name))
        (if (not nome) (setq nome (strcat "TUBO_" (itoa n_pipes))))

        ;; PVs de inicio e fim
        (setq start_name (_safe-get-nested obj 'StartStructure 'Name))
        (setq end_name (_safe-get-nested obj 'EndStructure 'Name))
        (if (not start_name)
          (setq start_name (_safe-get obj 'StartStructureName))
        )
        (if (not end_name)
          (setq end_name (_safe-get obj 'EndStructureName))
        )

        ;; Geometria
        (setq diam (_safe-get obj 'InnerDiameterOrWidth))
        (if (not diam) (setq diam (_safe-get obj 'InnerDiameter)))
        (if (not diam) (setq diam (_safe-get obj 'Diameter)))

        (setq len (_safe-get obj 'Length2DCenterToCenter))
        (if (not len) (setq len (_safe-get obj 'Length2D)))
        (if (not len) (setq len (_safe-get obj 'Length)))

        (setq slope (_safe-get obj 'Slope))

        ;; Cotas de inverso
        (setq inv_ini (_safe-get obj 'StartInvert))
        (if (not inv_ini) (setq inv_ini (_safe-get obj 'StartOffset)))
        (setq inv_fim (_safe-get obj 'EndInvert))
        (if (not inv_fim) (setq inv_fim (_safe-get obj 'EndOffset)))

        ;; Se conseguiu ler dados, BIM funciona
        (if (or start_name diam len) (setq bim_ok T))

        ;; Escrever CSV
        (write-line
          (strcat
            (_escape-csv (if nome nome "?")) ","
            (_escape-csv (if start_name start_name "?")) ","
            (_escape-csv (if end_name end_name "?")) ","
            (_num-to-str (if diam (* diam 1000) nil) 0) ","
            (_num-to-str len 2) ","
            (_num-to-str slope 6) ","
            "PVC,"
            (_num-to-str inv_ini 4) ","
            (_num-to-str inv_fim 4)
          )
          tubos_file
        )

        (setq n_pipes (1+ n_pipes))
        (princ (strcat "\n[EXTRAI]   Pipe: " (if nome nome "?")
                       " " (if start_name start_name "?")
                       "->" (if end_name end_name "?")
                       " DN=" (_num-to-str (if diam (* diam 1000) nil) 0)))
      )
    )

    ;; ── TEXT e MTEXT (sempre coletar) ──
    (if (or (= objname "AcDbText") (= objname "AcDbMText"))
      (progn
        (setq txt (_safe-get obj 'TextString))
        (setq layer (_safe-get obj 'Layer))
        (setq pos_var (_safe-get obj 'InsertionPoint))
        (setq x 0 y 0)
        (if pos_var
          (progn
            (setq pos_arr (vlax-variant-value pos_var))
            (setq x (vlax-safearray-get-element pos_arr 0))
            (setq y (vlax-safearray-get-element pos_arr 1))
          )
        )
        (if txt
          (progn
            (write-line
              (strcat
                (_escape-csv (if layer layer "0")) ","
                (_num-to-str x 3) ","
                (_num-to-str y 3) ","
                (_escape-csv txt)
              )
              textos_file
            )
            (setq n_texts (1+ n_texts))
          )
        )
      )
    )
  ) ;; fim vlax-for

  ;; ── CAMADA 2: Se BIM falhou, tentar EXPORTTOAUTOCAD ─────────────

  (if (not bim_ok)
    (progn
      (princ "\n[EXTRAI] Camada 1 FALHOU - propriedades BIM nao acessiveis")
      (princ "\n[EXTRAI] Camada 2: Tentando _EXPORTTOAUTOCAD...")

      ;; Tentar explodir objetos Civil 3D
      (vl-catch-all-apply
        '(lambda ()
          (command "_.-EXPORTTOAUTOCAD" "" "" "")
        )
      )

      ;; Depois de explodir, reiterar para pegar textos novos
      (princ "\n[EXTRAI] Re-iterando ModelSpace apos explosao...")
      (setq msp (vla-get-ModelSpace doc))

      (vlax-for obj msp
        (setq objname (vl-catch-all-apply 'vla-get-ObjectName (list obj)))
        (if (vl-catch-all-error-p objname) (setq objname "UNKNOWN"))

        (if (or (= objname "AcDbText") (= objname "AcDbMText"))
          (progn
            (setq txt (_safe-get obj 'TextString))
            (setq layer (_safe-get obj 'Layer))
            (setq pos_var (_safe-get obj 'InsertionPoint))
            (setq x 0 y 0)
            (if pos_var
              (progn
                (setq pos_arr (vlax-variant-value pos_var))
                (setq x (vlax-safearray-get-element pos_arr 0))
                (setq y (vlax-safearray-get-element pos_arr 1))
              )
            )
            (if txt
              (progn
                (write-line
                  (strcat
                    (_escape-csv (if layer layer "0")) ","
                    (_num-to-str x 3) ","
                    (_num-to-str y 3) ","
                    (_escape-csv txt)
                  )
                  textos_file
                )
                (setq n_texts (1+ n_texts))
              )
            )
          )
        )
      )
    )
  )

  ;; ── Fechar arquivos ─────────────────────────────────────────────

  (close pvs_file)
  (close tubos_file)
  (close textos_file)

  ;; ── Resumo ──────────────────────────────────────────────────────

  (princ "\n[EXTRAI] ========================================")
  (princ (strcat "\n[EXTRAI] Structures (PVs): " (itoa n_structs)))
  (princ (strcat "\n[EXTRAI] Pipes (Tubos):    " (itoa n_pipes)))
  (princ (strcat "\n[EXTRAI] Textos:           " (itoa n_texts)))
  (princ (strcat "\n[EXTRAI] BIM acessivel:    " (if bim_ok "SIM" "NAO")))
  (princ (strcat "\n[EXTRAI] CSVs em:          " output_dir))
  (princ "\n[EXTRAI] ========================================")

  ;; Escrever arquivo de status
  (setq status_file (open (strcat output_dir "EXTRACAO_STATUS.txt") "w"))
  (write-line (strcat "STRUCTURES=" (itoa n_structs)) status_file)
  (write-line (strcat "PIPES=" (itoa n_pipes)) status_file)
  (write-line (strcat "TEXTOS=" (itoa n_texts)) status_file)
  (write-line (strcat "BIM_OK=" (if bim_ok "1" "0")) status_file)
  (close status_file)

  (princ "\n[EXTRAI] CONCLUIDO.")
  (princ)
)

;;; ── Auto-executar se chamado via SCR ─────────────────────────────
;;; O SCR define a variavel CONSTRUDATA_OUTPUT_DIR antes de carregar
;;; este arquivo. Se existir, executa automaticamente.

(if (and (boundp 'CONSTRUDATA_OUTPUT_DIR)
         CONSTRUDATA_OUTPUT_DIR)
  (c:EXTRAI_REDE_CSV CONSTRUDATA_OUTPUT_DIR)
)

(princ "\n[EXTRAI] extrair_pipe_network.lsp carregado. Use (c:EXTRAI_REDE_CSV \"dir/\") para executar.")
(princ)
