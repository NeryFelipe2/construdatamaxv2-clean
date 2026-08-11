require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// ── SUPABASE ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
console.log('[SUPABASE] Conectado a', process.env.SUPABASE_URL ? process.env.SUPABASE_URL.slice(0,30)+'...' : 'SEM URL!');

console.log('Iniciando Motor do WhatsApp...');

const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'constru-wapp-v2' }), // Mudei ID para limpar cache
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']
    }
});

const qrc = require('qrcode');

client.on('qr', (qr) => {
    console.log('\n==================================================');
    console.log('📱 QR CODE RECEBIDO! GERANDO IMAGEM qr-code.png ...');
    
    // Salva o QR code em um arquivo de imagem para evitar quebras no terminal do Windows
    qrc.toFile('qr-code.png', qr, {
        color: { dark: '#000000', light: '#FFFFFF' }
    }, function (err) {
        if (err) throw err;
        console.log('👉 IMAGEM PRONTA: Abra o arquivo qr-code.png nesta mesma pasta e escaneie!');
        console.log('==================================================\n');
    });
});

let isReady = false;

client.on('ready', () => {
    isReady = true;
    console.log('\n✅ WHATSAPP CONECTADO COM SUCESSO A TORRE DE CONTROLE!');
    console.log('✅ AGORA SIM VOCÊ PODE APERTAR O BOTÃO VERDE LÁ NO SITE!');
});

const fs = require('fs');
const path = require('path');
const lastTaskMap = {};

// ── URL do backend FastAPI (rdo_engine) ──
const API_URL = process.env.CONSTRUDATA_API_URL || 'http://localhost:8000';

// ── Sessões em memória por número (wizard multi-passo) ──
// { '5511999999999@c.us': { etapa, rdo } }
const rdoSessions = {};

// ────────────────────────────────────────────────────────────────────────
// PARSER RDO BRUTAL — espelha campos do PDF hydronetwork/rdo
// Template esperado (case-insensitive, blocos podem vir em qualquer ordem):
//
//   RDO
//   NUCLEO: PARDINHO
//   DATA: 08/04/2026
//   RT: Felipe Nery
//   TRECHO: NS003
//   SISTEMA: esgoto
//   EXECUTADO: 73 m
//   CLIMA: sol/sol
//
//   SERVICOS:
//   - ASSENTAMENTO REDE DN150 73 m
//   - REMOCAO ENTULHO 20 m3
//
//   EQUIPE:
//   - Encanador 2
//   - Servente 3
//
//   FINANCEIRO:
//   - MAO_OBRA ALIMENTACAO 400 DESPESA
//   - EQUIPAMENTOS DIESEL 500 DESPESA
//
//   OCORRENCIAS:
//   - interferencia raiz 10:30
//
//   OBS: texto livre
// ────────────────────────────────────────────────────────────────────────
const CAT_MAP = {
    MO:'Mao de Obra', MAO:'Mao de Obra', MAO_OBRA:'Mao de Obra', MAOOBRA:'Mao de Obra',
    EQ:'Equipamentos', EQUIP:'Equipamentos', EQUIPAMENTOS:'Equipamentos',
    TR:'Transporte', TRANSP:'Transporte', TRANSPORTE:'Transporte',
    OUT:'Outros', OUTROS:'Outros', MAT:'Materiais', MATERIAIS:'Materiais',
};
const HEADER_RE = /^(NUCLEO|DATA|RT|TRECHO|SISTEMA|EXECUTADO|CLIMA|SERVICOS|EQUIPE|FINANCEIRO|OCORRENCIAS|OBS|FOTOS)\s*[:：]/i;

function _normDate(s) {
    // 08/04/2026 → 2026-04-08 ; ou passthrough se ja ISO
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (!m) return s;
    const dd = m[1].padStart(2,'0'), mm = m[2].padStart(2,'0');
    let yy = m[3]; if (yy.length===2) yy = '20'+yy;
    return `${yy}-${mm}-${dd}`;
}

function _parseServico(line) {
    // 'ASSENTAMENTO REDE DN150 73 m'
    const m = line.match(/(.+?)\s+([\d.,]+)\s*(m3|m2|ml|un|kg|t|h|m)\b\s*$/i);
    let descricao, quantidade, unidade, dn_mm = 0;
    if (m) {
        descricao = m[1].trim().toUpperCase();
        quantidade = parseFloat(m[2].replace(',','.'));
        unidade = m[3].toLowerCase();
    } else {
        descricao = line.trim().toUpperCase(); quantidade = 0; unidade = 'un';
    }
    const dn = descricao.match(/DN\s*(\d{2,4})/i);
    if (dn) dn_mm = parseInt(dn[1],10);
    return { servico: descricao, qtd: quantidade, unidade, dn_mm };
}

function _parseEquipe(line) {
    // 'Encanador 2'
    const m = line.match(/^(.+?)\s+(\d+)\s*$/);
    if (!m) return { funcao: line.trim(), qtd: 1 };
    return { funcao: m[1].trim(), qtd: parseInt(m[2],10) };
}

function _parseFinanceiro(line) {
    // 'MAO_OBRA ALIMENTACAO 400 DESPESA'
    const toks = line.trim().split(/\s+/);
    if (toks.length < 3) return null;
    const catRaw = toks.shift().toUpperCase().replace(/-/g,'_');
    const cat = CAT_MAP[catRaw] || catRaw.charAt(0)+catRaw.slice(1).toLowerCase();
    let tipo = 'DESPESA';
    if (toks.length && ['DESPESA','RECEITA'].includes(toks[toks.length-1].toUpperCase())) {
        tipo = toks.pop().toUpperCase();
    }
    // valor = ultimo token numerico (suporta 2409.84, 2409,84, 2.409,84, R$500)
    let valor = null, idx = -1;
    for (let i = toks.length-1; i >= 0; i--) {
        let raw = toks[i].replace(/R\$/i,'');
        if (raw.includes(',')) {
            // formato BR: tira pontos (milhar), troca virgula por ponto
            raw = raw.replace(/\./g,'').replace(',','.');
        }
        const v = parseFloat(raw);
        if (!isNaN(v) && /[\d]/.test(toks[i])) { valor = v; idx = i; break; }
    }
    if (valor === null) return null;
    const descricao = toks.slice(0, idx).join(' ').toUpperCase() || '-';
    return { categoria: cat, descricao, valor: Math.round(valor*100)/100, tipo };
}

function _parseOcorrencia(line) {
    const m = line.match(/^(.+?)\s+(\d{1,2}:\d{2})\s*$/);
    if (m) return { tipo: 'outro', desc: m[1].trim(), hora: m[2] };
    return { tipo: 'outro', desc: line.trim(), hora: '' };
}

function parseRDO(body) {
    const lines = body.split(/\r?\n/).map(l => l.trim());
    const payload = {
        data: new Date().toISOString().slice(0,10),
        nucleo: 'REDE',
        rt: '',
        clima: {},
        equipe: [],
        ocorrencias: [],
        fotos: [],
        servicos: {},
        financeiro: [],   // aceito pelo backend e encaminhado para logs
        _trecho: '',
        _sistema: '',
        _executado: 0,
        obs: '',
    };
    let block = null;
    const buf = {};
    for (const raw of lines) {
        if (!raw) { block = null; continue; }
        const head = raw.match(HEADER_RE);
        if (head) {
            block = head[1].toUpperCase();
            const rest = raw.slice(head[0].length).trim();
            if (['SERVICOS','EQUIPE','FINANCEIRO','OCORRENCIAS','FOTOS'].includes(block)) {
                buf[block] = [];
                if (rest) buf[block].push(rest.replace(/^[-*•]\s*/,''));
            } else {
                buf[block] = rest;
            }
            continue;
        }
        if (block && Array.isArray(buf[block])) {
            buf[block].push(raw.replace(/^[-*•]\s*/,''));
        } else if (block === 'OBS') {
            buf.OBS = (buf.OBS ? buf.OBS + '\n' : '') + raw;
        }
    }
    if (buf.NUCLEO)   payload.nucleo = buf.NUCLEO;
    if (buf.DATA)     payload.data = _normDate(buf.DATA);
    if (buf.RT)       payload.rt = buf.RT;
    if (buf.TRECHO)   payload._trecho = buf.TRECHO;
    if (buf.SISTEMA)  payload._sistema = buf.SISTEMA.toLowerCase();
    if (buf.EXECUTADO) payload._executado = parseFloat(buf.EXECUTADO.replace(/[^\d.,]/g,'').replace(',','.')) || 0;
    if (buf.CLIMA) {
        const [ma, ta] = buf.CLIMA.split('/').map(s => (s||'').trim());
        payload.clima = { manha: ma || '', tarde: ta || ma || '' };
    }
    if (buf.OBS) payload.obs = buf.OBS;

    const nsKey = payload._trecho || 'GERAL';
    payload.servicos[nsKey] = (buf.SERVICOS || []).map(_parseServico);
    payload.equipe = (buf.EQUIPE || []).map(_parseEquipe).filter(e => e.funcao);
    payload.financeiro = (buf.FINANCEIRO || []).map(_parseFinanceiro).filter(Boolean);
    payload.ocorrencias = (buf.OCORRENCIAS || []).map(_parseOcorrencia);

    return payload;
}

function resumoRDO(p) {
    const L = [];
    L.push('=== RDO ===');
    L.push(`Data:     ${p.data}`);
    L.push(`Nucleo:   ${p.nucleo}`);
    L.push(`RT:       ${p.rt || '-'}`);
    L.push(`Trecho:   ${p._trecho || '-'}  (${p._sistema || '-'})`);
    L.push(`Executado: ${p._executado} m`);
    L.push(`Equipe:   ${p.equipe.length} pessoa(s)`);
    const servList = Object.values(p.servicos || {}).flat();
    L.push(`Servicos: ${servList.length}`);
    for (const s of servList) L.push(`  - ${s.servico} ${s.qtd}${s.unidade}`);
    let td = 0, tr = 0;
    for (const l of p.financeiro) { (l.tipo === 'DESPESA' ? td += l.valor : tr += l.valor); }
    L.push(`Financeiro: -R$ ${td.toFixed(2)}  +R$ ${tr.toFixed(2)}  (${p.financeiro.length} lancamentos)`);
    if (p.ocorrencias.length) L.push(`Ocorrencias: ${p.ocorrencias.length}`);
    if (p.obs) L.push(`Obs: ${p.obs.slice(0,80)}`);
    return L.join('\n');
}

async function enviarRDOParaAPI(payload) {
    try {
        const r = await fetch(`${API_URL}/api/rdo`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
    } catch (e) {
        console.error('[RDO-API] Falha chamando POST /api/rdo:', e.message);
        return null;
    }
}

client.on('message', async message => {
    // IGNORAR GRUPOS COMPLETAMENTE
    if (message.from.includes('@g.us')) return;

    // Capturamos a resposta do cara
    const resposta = message.body.trim().toUpperCase();
    const emissor = message.from.replace('@c.us', '');
    const timestamp = new Date().toLocaleString('pt-BR');
    
    // SÓ INTERAGE SE A GENTE TIVER MANDADO UMA TAREFA PRA ESSE NÚMERO ANTES, OU SE FOR O PADRÃO RDO
    const up = message.body.toUpperCase();
    const isRDOCompleto = /^\s*RDO\s*$/m.test(up) && /TRECHO\s*[:：]/.test(up);
    const isRDO = isRDOCompleto || up.includes('EQUIPE REDE:') || up.includes('MATERIAL:');
    
    // ==========================================
    // MENU INTERATIVO E CAPTURA DE RDO
    // ==========================================
    if (resposta === 'MENU' || resposta === 'OI' || resposta === 'OLA' || resposta === 'OLÁ') {
        const msgMenu = `🤖 *ConstruData RDO - Central*\n\nPara lançar sua medição, basta enviar uma única mensagem seguindo exatamente esta máscara:\n\n1: [Prod Prevista]\n2: [Prod Real]\n3: [Custo Previsto]\n4: [Custo Real]\n5: [Custo Prev Fixo]\n6: [Custo Prev Var]\n7: [Custo Real Fixo]\n8: [Custo Real Var]\n\n*_Exemplo:_*\n1: 150\n2: 120\n3: 5000\n4: 6000\n5: 1000\n6: 4000\n7: 1500\n8: 4500`;
        return client.sendMessage(message.from, msgMenu);
    }

    if (/1\s*:/i.test(up) && /2\s*:/i.test(up) && /3\s*:/i.test(up) && /4\s*:/i.test(up)) {
         client.sendMessage(message.from, '⏳ *ConstruData RDO*\nAnalisando grandezas e salvando banco de dados nuvem (Supabase)...');
         try {
             const r = await fetch(`${API_URL}/api/whatsapp/send`, {
                 method: 'POST',
                 headers: {'Content-Type': 'application/json'},
                 body: JSON.stringify({
                     telefone: emissor,
                     mensagem: message.body,
                     ns_id: 1 // Default
                 }),
             });
             const dataApi = await r.json();
             if (dataApi.ok) {
                 return client.sendMessage(message.from, `✅ *RDO Gravado com Sucesso!*\n\nBanco: Supabase Nuvem\nOrigem: Vercel Serverless\n\nPronto para a proxima medição.`);
             } else {
                 return client.sendMessage(message.from, `❌ Falha no banco de dados. ${JSON.stringify(dataApi)}`);
             }
         } catch(e) {
             return client.sendMessage(message.from, `❌ Motor da API (Python/Vercel) está offline no momento. O desconto do Google tá alto hoje: ${e.message}`);
         }
    }

    if (!lastTaskMap[message.from] && !isRDO && !message.hasMedia) return;

    console.log(`[RCV] Mensagem/Resposta recebida de ${emissor}`);
    
    // Baixar mídia se tiver foto de RDO
    let mediaPath = '';
    if (message.hasMedia) {
        try {
            const media = await message.downloadMedia();
            if (media) {
                const extensao = media.mimetype.split('/')[1].split(';')[0];
                const nomeImg = `RDO_FOTO_${emissor}_${Date.now()}.${extensao}`;
                const baseDir = 'C:\\Users\\felip\\Downloads\\construdatamaxv2-clean\\frontend\\src\\assets\\fotos';
                if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
                mediaPath = path.join(baseDir, nomeImg);
                fs.writeFileSync(mediaPath, media.data, 'base64');
                console.log(`[RDO] FOTO SALVA! -> ${mediaPath}`);
            }
        } catch(e) {
            console.log('[RDO] Erro ao baixar foto', e);
        }
    }

    // Se respondeu OK ou CIENTE, a gente manda uma auto-resposta confirmando e atualiza LPS
    if((resposta === 'OK' || resposta === 'CIENTE') && lastTaskMap[message.from]) {
        client.sendMessage(message.from, '✅ *Sistema ConstruDataMax*\nAviso recebido! Sua tarefa foi baixada como CONCLUÍDA na Torre de Controle.');
        
        // MÁGICA: ATUALIZAR O FRONTEND (LPS) EM TEMPO REAL!
        const tId = lastTaskMap[message.from];
        const jsPath = 'C:\\Users\\felip\\Downloads\\construdatamaxv2-clean\\frontend\\src\\data\\workflow_status.json';
        try {
            let st = {};
            if(fs.existsSync(jsPath)) {
                const data = fs.readFileSync(jsPath, 'utf8');
                if (data.trim() !== '') st = JSON.parse(data);
            }
            st[tId] = 'DONE';
            fs.writeFileSync(jsPath, JSON.stringify(st, null, 2));
            console.log(`[LPS] Linha de Balanço Atualizada! Tarefa ${tId} do número ${emissor} marcada como CONCLUÍDA.`);
            
            // Tira do mapa para não responder mais comandos velhos
            delete lastTaskMap[message.from];
            
            // SE A TAREFA TINHA A VER COM RDO, JÁ MANDA O MENU DIRETO!
            const msgMenu = `🤖 *ConstruData RDO - Central*\n\nComo sua tarefa era lançar medição, envie os dados na mesma mensagem seguindo exatamente esta máscara:\n\n1: [Prod Prevista]\n2: [Prod Real]\n3: [Custo Previsto]\n4: [Custo Real]\n5: [Custo Prev Fixo]\n6: [Custo Prev Var]\n7: [Custo Real Fixo]\n8: [Custo Real Var]\n\n*_Exemplo:_*\n1: 150\n2: 120\n3: 5000\n4: 6000\n5: 1000\n6: 4000\n7: 1500\n8: 4500`;
            return client.sendMessage(message.from, msgMenu);

        } catch(e) {
            console.error('[LPS ERRO]', e);
        }
    }

    // REGISTRO AUTOMÁTICO NO OBSIDIAN MODO CAIXA-PRETA E RDO
    const obsidianPath = 'C:\\Users\\felip\\Downloads\\COFREOBSIDIAN\\antigravity\\Projects\\ConstruDataMax\\WhatsApp-Logs-Campo.md';
    let conteudo = '';
    if (!fs.existsSync(obsidianPath)) {
        conteudo += `---\ntags: [Log, WhatsApp, Operacao, RDO]\ntype: Log-Comunicaçao\n---\n\n# 📱 Caixa-Preta do WhatsApp (Operações)\n*Este arquivo é gerado de forma 100% autônoma pelo Motor do ConstruDataMax*\n\n`;
    }
    
    if (isRDO) {
        conteudo += `\n## 📝 RDO RECEBIDO DE CAMPO (WhatsApp)\n### 🕒 ${timestamp} | **Origem:** ${emissor}\n\n\`\`\`text\n${message.body}\n\`\`\`\n\n`;
        if (typeof mediaPath !== 'undefined' && mediaPath) conteudo += `📸 **Foto de Evidência Localizada em:** \`${mediaPath}\`\n\n---\n`;

        // ── RDO COMPLETO: parseia e envia pro backend FastAPI (rdo_engine) ──
        if (isRDOCompleto) {
            try {
                const payload = parseRDO(message.body);
                if (mediaPath) payload.fotos.push({ caminho: mediaPath, legenda: 'WhatsApp', ns_id: payload._trecho || null });
                const resp = await enviarRDOParaAPI(payload);
                const rdoNum = resp && (resp.numero || resp.id);
                const resumo = resumoRDO(payload);
                const confirm = rdoNum
                    ? `✅ *RDO #${rdoNum}* gravado na plataforma.\n\n${resumo}`
                    : `⚠️ RDO parseado mas backend offline — dados salvos em log.\n\n${resumo}`;
                client.sendMessage(message.from, confirm);
            } catch(e) {
                console.error('[RDO-PARSE] Erro:', e);
                client.sendMessage(message.from, `⚠️ RDO recebido mas erro no parse: ${e.message}\nEnvie no formato: RDO\\nNUCLEO: ...\\nTRECHO: ...\\nSERVICOS:\\n- ...`);
            }
        } else {
            client.sendMessage(message.from, '📋 *ConstruDataMax*\nRDO recebido e catalogado com sucesso na base de projetos (Obsidian / Plataforma).');
        }
    } else {
        conteudo += `\n### 🕒 ${timestamp}\n**Origem:** ${emissor}\n**Mensagem:** "${message.body}"\n**Status da Tarefa:** ${resposta === 'OK' ? '🟢 Concluída' : '🟡 Observação Anexada'}\n---\n`;
    }
    
    try {
        fs.appendFileSync(obsidianPath, conteudo, 'utf8');
        console.log(`[OBSIDIAN] Log / RDO gravado com sucesso no seu cofre!`);
    } catch (e) {
        console.error('Falha ao escrever no log do Obsidian:', e);
    }

    // GRAVAR TAMBÉM NO SUPABASE (nuvem)
    try {
        await supabase.from('logs_rdo').insert({
            emissor,
            mensagem: message.body,
            foto_url: (typeof mediaPath !== 'undefined' && mediaPath) ? mediaPath : null,
            tipo: isRDO ? 'rdo' : (resposta === 'OK' ? 'tarefa_ok' : 'mensagem'),
            task_id: lastTaskMap[message.from] || null
        });
        console.log(`[SUPABASE] Log persistido na nuvem!`);
    } catch(e) {
        console.error('[SUPABASE] Erro gravando log:', e);
    }
});

// ── Gerenciar Equipes (SUPABASE) ──
app.get('/api/team', async (req, res) => {
    try {
        const { data, error } = await supabase.from('equipes').select('*').order('created_at');
        if (error) throw error;
        // Mapear para o formato que o frontend espera
        const mapped = (data || []).map(d => ({
            id: d.id, nome: d.nome, celular: d.celular, cargo: d.cargo,
            equipeNome: d.equipe_nome, projeto: d.projeto, status: d.status
        }));
        res.json(mapped);
    } catch(e) {
        console.error('[SUPABASE] Erro lendo equipes:', e.message);
        // Fallback: tenta ler do arquivo local
        const TEAM_FILE = 'C:\\Users\\felip\\Downloads\\construdatamaxv2-clean\\frontend\\src\\data\\team.json';
        try { if(fs.existsSync(TEAM_FILE)) return res.send(fs.readFileSync(TEAM_FILE, 'utf8')); } catch(_){}
        res.json([]);
    }
});

app.post('/api/team', async (req, res) => {
    try {
        const membros = req.body; // array do frontend
        // Limpa tabela e reinsere (sync total)
        await supabase.from('equipes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (membros.length > 0) {
            const rows = membros.map(m => ({
                nome: m.nome, celular: m.celular, cargo: m.cargo,
                equipe_nome: m.equipeNome || m.equipe_nome || '', projeto: m.projeto || '', status: m.status || 'Ativo'
            }));
            const { error } = await supabase.from('equipes').insert(rows);
            if (error) throw error;
        }
        res.json({ success: true });
    } catch(e) {
        console.error('[SUPABASE] Erro salvando equipes:', e.message);
        res.status(500).json({ error: 'Falha gravando equipe no Supabase' });
    }
});

// ── Logs RDO (SUPABASE) ──
app.get('/api/logs', async (req, res) => {
    try {
        const { data, error } = await supabase.from('logs_rdo').select('*').order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        res.json(data || []);
    } catch(e) { res.json([]); }
});

// Endpoint chamado pelo nosso FastAPI
app.post('/api/send', async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ error: 'WhatsApp ainda está sincronizando no fundo. Aguarde a mensagem de sucesso no terminal preta!' });
    }
    
    const { number, text, taskId } = req.body;
    
    if (!number || !text) {
        return res.status(400).json({ error: 'Número e texto obrigatórios' });
    }

    try {
        // Formata o número (se for Brasil: DDI + DDD + Numero + @c.us)
        // number deve vir como '5511999999999'
        const chatId = `${number.replace(/\D/g, '')}@c.us`;
        
        if (taskId) lastTaskMap[chatId] = taskId;
        
        await client.sendMessage(chatId, text);
        console.log(`[SND] Mensagem disparada para ${chatId}`);
        
        res.json({ success: true, message: 'Disparado' });
    } catch (error) {
        console.error('Erro ao enviar = ', error);
        res.status(500).json({ error: 'Falha no disparo' });
    }
});

client.initialize();

const PORT = 8090;
app.listen(PORT, () => {
    console.log(`🚀 Motor interno express rodando na porta ${PORT}`);
});
