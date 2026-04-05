const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

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

client.on('message', async message => {
    // IGNORAR GRUPOS COMPLETAMENTE
    if (message.from.includes('@g.us')) return;

    // Capturamos a resposta do cara
    const resposta = message.body.trim().toUpperCase();
    const emissor = message.from.replace('@c.us', '');
    const timestamp = new Date().toLocaleString('pt-BR');
    
    // SÓ INTERAGE SE A GENTE TIVER MANDADO UMA TAREFA PRA ESSE NÚMERO ANTES, OU SE FOR O PADRÃO RDO
    const isRDO = message.body.toUpperCase().includes('EQUIPE REDE:') || message.body.toUpperCase().includes('MATERIAL:');
    
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

    // Se respondeu OK, a gente manda uma auto-resposta confirmando e atualiza LPS
    if(resposta === 'OK' && lastTaskMap[message.from]) {
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
            
            // Tira do mapa para não responder mais comandos OK velhos
            delete lastTaskMap[message.from];
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
        client.sendMessage(message.from, '📋 *ConstruDataMax*\nRDO recebido e catalogado com sucesso na base de projetos (Obsidian / Plataforma).');
    } else {
        conteudo += `\n### 🕒 ${timestamp}\n**Origem:** ${emissor}\n**Mensagem:** "${message.body}"\n**Status da Tarefa:** ${resposta === 'OK' ? '🟢 Concluída' : '🟡 Observação Anexada'}\n---\n`;
    }
    
    try {
        fs.appendFileSync(obsidianPath, conteudo, 'utf8');
        console.log(`[OBSIDIAN] Log / RDO gravado com sucesso no seu cofre!`);
    } catch (e) {
        console.error('Falha ao escrever no log do Obsidian:', e);
    }
});

// Gerenciar Equipes (Contato Book)
const TEAM_FILE = 'C:\\Users\\felip\\Downloads\\construdatamaxv2-clean\\frontend\\src\\data\\team.json';
app.get('/api/team', (req, res) => {
    try {
        if(fs.existsSync(TEAM_FILE)) res.send(fs.readFileSync(TEAM_FILE, 'utf8'));
        else res.json([]);
    } catch(e) { res.json([]); }
});

app.post('/api/team', (req, res) => {
    try {
        fs.writeFileSync(TEAM_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Falha gravando team' }); }
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
