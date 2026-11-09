// api/enviar.js — recebe pedidos e candidaturas do site e posta no Discord usando o bot.
// Variáveis de ambiente (Vercel > Settings > Environment Variables):
//   DISCORD_BOT_TOKEN   (obrigatória) token do seu bot — pode ser escrita em minúsculas: discord_bot_token
//   PEDIDOS_CHANNEL_ID  (opcional)    padrão: 1566175654242680982
//   CONTRATOS_CHANNEL_ID (opcional)   padrão: 1566177160387887184

// Aceita o nome em maiúsculas ou minúsculas (o painel do Vercel pode só aceitar minúsculas).
const env = (nome) => process.env[nome] || process.env[nome.toLowerCase()];

const CANAIS = {
  pedido: env('PEDIDOS_CHANNEL_ID') || '1566175654242680982',
  candidatura: env('CONTRATOS_CHANNEL_ID') || '1566177160387887184',
};

// Mantenha igual ao cardápio do site (nome exato e preço).
const CARDAPIO = {
  'Calabresa': 45,
  'Margherita': 47,
  'Quatro Queijos': 38,
  'Frango com Bacon': 44,
  'Batatas Fritas': 14,
  'Combo Ringo\u2019s': 67,
  'Refrigerante Soda': 3,
  'Refrigerante Sprunk': 3,
  'Refrigerante eCola': 3,
  'Refrigerante Orang-O-Tang': 3,
  'Cerveja Gelada': 4,
  '\u00c1gua Mineral': 3,
  'Suco Natural': 6,
};

const limpa = (v, max) =>
  String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const dinheiro = (n) => '$ ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',00';
const campo = (name, value, inline) => ({ name, value: String(value || '\u2014').slice(0, 1000), inline: !!inline });

function montaPedido(b) {
  const nome = limpa(b.nome, 40);
  const tel = limpa(b.tel, 12);
  const entrega = limpa(b.entrega, 20);
  const pagamento = limpa(b.pagamento, 10);
  if (nome.length < 2) return { erro: 'nome' };
  if (!/^\d{3}-\d{3}-\d{4}$/.test(tel)) return { erro: 'telefone' };
  if (!['Retirada no balc\u00e3o', 'Entrega'].includes(entrega)) return { erro: 'entrega' };
  if (!['Dinheiro', 'Cart\u00e3o'].includes(pagamento)) return { erro: 'pagamento' };

  let endereco = 'Retirada no balc\u00e3o';
  if (entrega === 'Entrega') {
    const rua = limpa(b.rua, 40), num = limpa(b.num, 6), bairro = limpa(b.bairro, 40), ref = limpa(b.ref, 60);
    if (!rua || !num || !bairro) return { erro: 'endereco' };
    endereco = `Entrega: ${rua}, ${num} - ${bairro}` + (ref ? ` (Ref.: ${ref})` : '');
  }

  if (!Array.isArray(b.itens) || b.itens.length === 0 || b.itens.length > 20) return { erro: 'itens' };
  let total = 0;
  let combos = 0;
  const linhas = [];
  for (const it of b.itens) {
    const n = limpa(it && it.n, 40);
    const q = Number(it && it.q);
    if (!Object.prototype.hasOwnProperty.call(CARDAPIO, n) || !Number.isInteger(q) || q < 1 || q > 50) {
      return { erro: 'itens' };
    }
    total += CARDAPIO[n] * q;
    if (n === 'Combo Ringo\u2019s') combos += q;
    linhas.push(`${q}x ${n} \u2014 ${dinheiro(CARDAPIO[n] * q)}`);
  }

  // Refrigerantes do combo: "atendente" escolhe, ou o cliente informa exatamente 3 por combo.
  let refrigerantes = '';
  if (combos > 0) {
    const ref = b.combo_ref;
    if (ref === 'atendente') {
      refrigerantes = 'Aleat\u00f3rio (escolha da casa)';
    } else if (ref && typeof ref === 'object') {
      const nomes = { soda: 'Soda', sprunk: 'Sprunk', ecola: 'eCola', orang: 'Orang-O-Tang' };
      const partes = [];
      let soma = 0;
      for (const k of Object.keys(nomes)) {
        const v = Number(ref[k] || 0);
        if (!Number.isInteger(v) || v < 0 || v > 150) return { erro: 'combo' };
        soma += v;
        if (v > 0) partes.push(`${v} ${nomes[k]}`);
      }
      if (soma !== combos * 3) return { erro: 'combo' };
      refrigerantes = partes.join(', ');
    } else {
      return { erro: 'combo' };
    }
  }

  const campos = [
    campo('Cliente', `${nome}\n${tel}`, true),
    campo('Recebimento', endereco, true),
    campo('Pagamento', pagamento, true),
    campo('Itens', linhas.join('\n')),
  ];
  if (refrigerantes) campos.push(campo('Refrigerantes do combo', refrigerantes));
  campos.push(campo('Total', `**${dinheiro(total)}**`));

  return {
    embed: {
      title: 'Novo pedido',
      color: 0xff0a9a,
      fields: campos,
      footer: { text: 'Pedido feito pelo site' },
      timestamp: new Date().toISOString(),
    },
  };
}

function montaCandidatura(b) {
  const nome = limpa(b.nome, 40);
  const tel = limpa(b.tel, 12);
  const cargo = limpa(b.cargo, 40);
  if (nome.length < 2) return { erro: 'nome' };
  if (!/^\d{3}-\d{3}-\d{4}$/.test(tel)) return { erro: 'telefone' };
  if (!cargo) return { erro: 'cargo' };
  return {
    embed: {
      title: 'Nova candidatura',
      color: 0xffcb05,
      fields: [
        campo('Nome', nome, true),
        campo('Telefone', tel, true),
        campo('Idade', limpa(b.idade, 3), true),
        campo('Cargo de interesse', cargo),
        campo('Experi\u00eancia', limpa(b.exp, 400)),
        campo('Disponibilidade', limpa(b.disp, 80)),
        campo('Sobre a pessoa', limpa(b.sobre, 400)),
      ],
      footer: { text: 'Candidatura enviada pelo site' },
      timestamp: new Date().toISOString(),
    },
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const token = env('DISCORD_BOT_TOKEN');
  if (!token) return res.status(500).json({ ok: false, erro: 'configuracao' });

  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch (_) { return res.status(400).json({ ok: false }); }
  }
  if (!b || typeof b !== 'object') return res.status(400).json({ ok: false });

  // Campo-armadilha: robôs preenchem, pessoas não. Finge sucesso e descarta.
  if (b.hp) return res.status(200).json({ ok: true });

  const tipo = b.tipo === 'pedido' || b.tipo === 'candidatura' ? b.tipo : null;
  if (!tipo) return res.status(400).json({ ok: false });

  const r = tipo === 'pedido' ? montaPedido(b) : montaCandidatura(b);
  if (r.erro) return res.status(400).json({ ok: false, erro: r.erro });

  try {
    const resp = await fetch(`https://discord.com/api/v10/channels/${CANAIS[tipo]}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [r.embed], allowed_mentions: { parse: [] } }),
    });
    if (!resp.ok) return res.status(502).json({ ok: false, erro: 'discord' });
    return res.status(200).json({ ok: true });
  } catch (_) {
    return res.status(502).json({ ok: false, erro: 'discord' });
  }
};
