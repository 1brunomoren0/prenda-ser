import { supabase } from './supabase.js'

// ── State ────────────────────────────────────────────────────────
let barracas = []
let movimentos = []
let estoqueInicial = { p: 0, m: 0, g: 0 }
let saldo = { p: 0, m: 0, g: 0 }
let estoqueEdit = { p: 0, m: 0, g: 0 }
let saidaTemp = { p: 0, m: 0, g: 0 }
let retornoTemp = { p: 0, m: 0, g: 0 }
let currentTab = 'inicio'

// ── Boot ─────────────────────────────────────────────────────────
async function boot() {
  renderShell()
  await loadAll()
  renderTab(currentTab)
  subscribeRealtime()
}

async function loadAll() {
  showLoading(true)
  const [{ data: b }, { data: m }, { data: e }] = await Promise.all([
    supabase.from('barracas').select('*').order('created_at'),
    supabase.from('movimentos').select('*').order('created_at'),
    supabase.from('estoque').select('*').limit(1).maybeSingle()
  ])
  barracas = b || []
  movimentos = m || []
  if (e) {
    estoqueInicial = { p: e.p, m: e.m, g: e.g }
    estoqueEdit = { ...estoqueInicial }
    recalcSaldo()
  }
  showLoading(false)
}

function recalcSaldo() {
  saldo = { ...estoqueInicial }
  movimentos.forEach(mv => {
    const sign = mv.tipo === 'saida' ? -1 : 1
    saldo.p += sign * mv.qtd_p
    saldo.m += sign * mv.qtd_m
    saldo.g += sign * mv.qtd_g
  })
}

// ── Realtime ─────────────────────────────────────────────────────
function subscribeRealtime() {
  supabase.channel('changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'barracas' }, async () => {
      const { data } = await supabase.from('barracas').select('*').order('created_at')
      barracas = data || []
      renderTab(currentTab)
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'movimentos' }, async () => {
      const { data } = await supabase.from('movimentos').select('*').order('created_at')
      movimentos = data || []
      recalcSaldo()
      renderTab(currentTab)
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque' }, async () => {
      const { data } = await supabase.from('estoque').select('*').limit(1).maybeSingle()
      if (data) { estoqueInicial = { p: data.p, m: data.m, g: data.g }; estoqueEdit = { ...estoqueInicial }; recalcSaldo() }
      renderTab(currentTab)
    })
    .subscribe()
}

// ── Shell ─────────────────────────────────────────────────────────
function renderShell() {
  document.getElementById('app').innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <span class="header-icon">🎪</span>
        <div class="header-text">
          <div class="header-title">Prendas — Festa Junina</div>
          <div class="header-sub">Colégio SER · Controle de distribuição</div>
        </div>
      </header>

      <main class="app-content" id="content">
        <div class="loading"><div class="spinner"></div> Carregando…</div>
      </main>

      <nav class="app-nav">
        ${navBtn('inicio','home','Início')}
        ${navBtn('barracas','store','Barracas')}
        ${navBtn('estoque','box','Estoque')}
        ${navBtn('saida','arrow-right','Saída')}
        ${navBtn('retorno','arrow-left','Retorno')}
        ${navBtn('relatorio','chart','Relatório')}
      </nav>
    </div>
    <div class="toast" id="toast"></div>
  `
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  })
}

function navBtn(tab, icon, label) {
  const icons = {
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/><path d="M3 12v9h18v-9"/></svg>`,
    store: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    'arrow-right': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
    'arrow-left': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
    chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`
  }
  return `<button class="nav-btn${tab === currentTab ? ' active' : ''}" data-tab="${tab}">${icons[icon]}<span>${label}</span></button>`
}

function switchTab(tab) {
  currentTab = tab
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
  renderTab(tab)
}

function showLoading(on) {
  if (on) document.getElementById('content').innerHTML = `<div class="loading"><div class="spinner"></div> Carregando…</div>`
}

// ── Tab Router ────────────────────────────────────────────────────
function renderTab(tab) {
  const map = { inicio: renderInicio, barracas: renderBarracas, estoque: renderEstoque, saida: renderSaida, retorno: renderRetorno, relatorio: renderRelatorio }
  const fn = map[tab]
  if (fn) {
    document.getElementById('content').innerHTML = `<div class="section active" id="tab-${tab}">${fn()}</div>`
    attachHandlers(tab)
  }
}

// ── INÍCIO ────────────────────────────────────────────────────────
function renderInicio() {
  const saidas = movimentos.filter(m => m.tipo === 'saida')
  const distP = saidas.reduce((a, m) => a + m.qtd_p, 0)
  const distM = saidas.reduce((a, m) => a + m.qtd_m, 0)
  const distG = saidas.reduce((a, m) => a + m.qtd_g, 0)
  const recentes = [...movimentos].reverse().slice(0, 5)

  return `
    <p class="page-title">Visão geral</p>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-val">${estoqueInicial.p}</div><div class="stat-lbl">Estoque inicial P</div></div>
      <div class="stat-card"><div class="stat-val">${estoqueInicial.m}</div><div class="stat-lbl">Estoque inicial M</div></div>
      <div class="stat-card"><div class="stat-val">${estoqueInicial.g}</div><div class="stat-lbl">Estoque inicial G</div></div>
      <div class="stat-card"><div class="stat-val">${barracas.length}</div><div class="stat-lbl">Barracas</div></div>
    </div>

    <div class="card">
      <div class="card-title">Distribuído (líquido)</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="badge badge-p">P: ${distP}</span>
        <span class="badge badge-m">M: ${distM}</span>
        <span class="badge badge-g">G: ${distG}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Saldo disponível</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="badge badge-p">P: ${saldo.p}</span>
        <span class="badge badge-m">M: ${saldo.m}</span>
        <span class="badge badge-g">G: ${saldo.g}</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Movimentações recentes</div>
      ${recentes.length ? recentes.map(movimHTML).join('') : emptyState('Nenhuma movimentação ainda')}
    </div>
  `
}

// ── BARRACAS ──────────────────────────────────────────────────────
function renderBarracas() {
  return `
    <p class="page-title">Barracas</p>
    <div class="card">
      <div class="form-group"><label>Nome da barraca</label><input id="input-barraca" type="text" placeholder="Ex: Argolas, Pesca, Correio Elegante…" /></div>
      <div class="form-group"><label>Responsável</label><input id="input-responsavel" type="text" placeholder="Nome de quem retira as prendas" /></div>
      <button class="btn btn-primary btn-block" id="btn-add-barraca">＋ Cadastrar barraca</button>
    </div>
    <div id="lista-barracas">
      ${barracas.length ? barracas.map(b => `
        <div class="card" style="margin-bottom:8px">
          <div class="list-item" style="padding:0">
            <div class="list-item-main">
              <div class="list-item-name">${b.nome}</div>
              ${b.responsavel ? `<div class="list-item-sub">👤 ${b.responsavel}</div>` : ''}
            </div>
            <button class="btn btn-outline btn-sm" data-del-barraca="${b.id}">🗑</button>
          </div>
        </div>
      `).join('') : emptyState('Nenhuma barraca cadastrada')}
    </div>
  `
}

// ── ESTOQUE ───────────────────────────────────────────────────────
function renderEstoque() {
  return `
    <p class="page-title">Estoque de prendas</p>
    <p class="page-sub">Informe o total de prendas disponíveis para a festa.</p>
    <div class="card">
      ${qtyRow('est', 'p', 'P', 'Pequena', estoqueEdit.p)}
      ${qtyRow('est', 'm', 'M', 'Média', estoqueEdit.m)}
      ${qtyRow('est', 'g', 'G', 'Grande', estoqueEdit.g)}
      <div class="divider"></div>
      <button class="btn btn-primary btn-block" id="btn-salvar-estoque">💾 Salvar estoque inicial</button>
    </div>
    ${(estoqueInicial.p || estoqueInicial.m || estoqueInicial.g) ? `
    <div class="card">
      <div class="card-title">Saldo atual</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="badge badge-p">P: ${saldo.p}</span>
        <span class="badge badge-m">M: ${saldo.m}</span>
        <span class="badge badge-g">G: ${saldo.g}</span>
      </div>
    </div>` : ''}
  `
}

// ── SAÍDA ─────────────────────────────────────────────────────────
function renderSaida() {
  return `
    <p class="page-title">Dar saída de prendas</p>
    <div class="card">
      <div class="form-group">
        <label>Barraca de destino</label>
        <select id="sel-barraca-saida">
          <option value="">Selecione a barraca…</option>
          ${barracas.map(b => `<option value="${b.id}">${b.nome}${b.responsavel ? ' — ' + b.responsavel : ''}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Retirado por</label><input id="input-por" type="text" placeholder="Nome de quem está retirando" /></div>
      <div class="divider"></div>
      <div class="card-title" style="margin-bottom:6px">Quantidade</div>
      ${qtyRow('saida', 'p', 'P', 'Pequena', saidaTemp.p)}
      ${qtyRow('saida', 'm', 'M', 'Média', saidaTemp.m)}
      ${qtyRow('saida', 'g', 'G', 'Grande', saidaTemp.g)}
      <div class="divider"></div>
      <div class="highlight-box" style="margin-bottom:10px">
        Saldo disponível: <strong>P ${saldo.p}</strong> · <strong>M ${saldo.m}</strong> · <strong>G ${saldo.g}</strong>
      </div>
      <button class="btn btn-danger btn-block" id="btn-confirmar-saida">→ Confirmar saída</button>
    </div>
  `
}

// ── RETORNO ───────────────────────────────────────────────────────
function renderRetorno() {
  return `
    <p class="page-title">Retorno de prendas</p>
    <p class="page-sub">Registre as prendas que sobraram nas barracas ao fim da festa.</p>
    <div class="card">
      <div class="form-group">
        <label>Barraca de origem</label>
        <select id="sel-barraca-retorno">
          <option value="">Selecione a barraca…</option>
          ${barracas.map(b => `<option value="${b.id}">${b.nome}${b.responsavel ? ' — ' + b.responsavel : ''}</option>`).join('')}
        </select>
      </div>
      <div class="divider"></div>
      <div class="card-title" style="margin-bottom:6px">Quantidade devolvida</div>
      ${qtyRow('ret', 'p', 'P', 'Pequena', retornoTemp.p)}
      ${qtyRow('ret', 'm', 'M', 'Média', retornoTemp.m)}
      ${qtyRow('ret', 'g', 'G', 'Grande', retornoTemp.g)}
      <div class="divider"></div>
      <button class="btn btn-success btn-block" id="btn-confirmar-retorno">← Confirmar retorno</button>
    </div>
  `
}

// ── RELATÓRIO ─────────────────────────────────────────────────────
function renderRelatorio() {
  if (!movimentos.length && !estoqueInicial.p && !estoqueInicial.m && !estoqueInicial.g) {
    return `<p class="page-title">Relatório geral</p>${emptyState('Nenhum dado registrado ainda')}`
  }
  const saidas = movimentos.filter(m => m.tipo === 'saida')
  const retornos = movimentos.filter(m => m.tipo === 'retorno')
  const usadoP = saidas.reduce((a,m)=>a+m.qtd_p,0) - retornos.reduce((a,m)=>a+m.qtd_p,0)
  const usadoM = saidas.reduce((a,m)=>a+m.qtd_m,0) - retornos.reduce((a,m)=>a+m.qtd_m,0)
  const usadoG = saidas.reduce((a,m)=>a+m.qtd_g,0) - retornos.reduce((a,m)=>a+m.qtd_g,0)

  const porBarraca = {}
  movimentos.forEach(mv => {
    const bar = barracas.find(b => b.id === mv.barraca_id)
    const nome = bar ? bar.nome : mv.barraca_id
    if (!porBarraca[nome]) porBarraca[nome] = { saiuP:0,saiuM:0,saiuG:0,voltouP:0,voltouM:0,voltouG:0 }
    if (mv.tipo === 'saida') { porBarraca[nome].saiuP+=mv.qtd_p; porBarraca[nome].saiuM+=mv.qtd_m; porBarraca[nome].saiuG+=mv.qtd_g }
    else { porBarraca[nome].voltouP+=mv.qtd_p; porBarraca[nome].voltouM+=mv.qtd_m; porBarraca[nome].voltouG+=mv.qtd_g }
  })

  return `
    <p class="page-title">Relatório geral</p>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-val" style="color:#1b5e20">${usadoP}</div><div class="stat-lbl">P utilizadas</div></div>
      <div class="stat-card"><div class="stat-val" style="color:#6d4c00">${usadoM}</div><div class="stat-lbl">M utilizadas</div></div>
    </div>
    <div class="stats-grid" style="margin-top:0">
      <div class="stat-card"><div class="stat-val" style="color:#7b1a2e">${usadoG}</div><div class="stat-lbl">G utilizadas</div></div>
      <div class="stat-card"><div class="stat-val">${saldo.p+saldo.m+saldo.g}</div><div class="stat-lbl">Saldo restante</div></div>
    </div>

    <div class="card">
      <div class="card-title">Por barraca</div>
      ${Object.entries(porBarraca).map(([nome, v]) => {
        const usP = v.saiuP - v.voltouP, usM = v.saiuM - v.voltouM, usG = v.saiuG - v.voltouG
        return `<div class="list-item">
          <div class="list-item-main">
            <div class="list-item-name">${nome}</div>
            <div class="list-item-sub">
              ${v.saiuP||v.saiuM||v.saiuG ? `Saiu: <span class="badge badge-p">${v.saiuP}P</span> <span class="badge badge-m">${v.saiuM}M</span> <span class="badge badge-g">${v.saiuG}G</span>` : ''}
            </div>
          </div>
          <div style="text-align:right;font-size:12px;color:var(--gray-600)">
            Usou: ${usP}P ${usM}M ${usG}G
          </div>
        </div>`
      }).join('')}
    </div>

    <div class="card">
      <div class="card-title">Histórico completo (${movimentos.length})</div>
      ${movimentos.length ? [...movimentos].reverse().map(movimHTML).join('') : emptyState('Sem movimentos')}
    </div>
  `
}

// ── Helpers ───────────────────────────────────────────────────────
function qtyRow(prefix, tam, sigla, nome, val) {
  return `<div class="qty-row">
    <div class="qty-label"><span class="badge badge-${tam}">${sigla}</span> ${nome}</div>
    <div class="qty-ctrl">
      <button class="qty-btn" data-qty="${prefix}" data-tam="${tam}" data-delta="-1">−</button>
      <span class="qty-val" id="qty-${prefix}-${tam}">${val}</span>
      <button class="qty-btn" data-qty="${prefix}" data-tam="${tam}" data-delta="1">+</button>
    </div>
  </div>`
}

function movimHTML(mv) {
  const bar = barracas.find(b => b.id === mv.barraca_id)
  const nome = bar ? bar.nome : '?'
  const partes = []
  if (mv.qtd_p) partes.push(`${mv.qtd_p}P`)
  if (mv.qtd_m) partes.push(`${mv.qtd_m}M`)
  if (mv.qtd_g) partes.push(`${mv.qtd_g}G`)
  const hora = mv.created_at ? new Date(mv.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) : ''
  return `<div class="movim-item">
    <div class="movim-top">
      <span class="movim-name">${nome}</span>
      <span class="badge ${mv.tipo === 'saida' ? 'badge-saida' : 'badge-retorno'}">${mv.tipo === 'saida' ? '↑ Saída' : '↓ Retorno'}</span>
    </div>
    <div class="movim-detail">
      <span>${partes.join(' · ')}</span>
      ${mv.retirado_por ? `<span>— ${mv.retirado_por}</span>` : ''}
      ${hora ? `<span>· ${hora}</span>` : ''}
    </div>
  </div>`
}

function emptyState(msg) {
  return `<div class="empty"><div class="empty-icon">📦</div>${msg}</div>`
}

function toast(msg) {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 2200)
}

// ── Event Handlers ────────────────────────────────────────────────
function attachHandlers(tab) {
  // Qty buttons (universal)
  document.querySelectorAll('[data-qty]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { qty, tam, delta } = btn.dataset
      if (qty === 'est') {
        estoqueEdit[tam] = Math.max(0, estoqueEdit[tam] + Number(delta))
        document.getElementById(`qty-est-${tam}`).textContent = estoqueEdit[tam]
      } else if (qty === 'saida') {
        saidaTemp[tam] = Math.max(0, saidaTemp[tam] + Number(delta))
        document.getElementById(`qty-saida-${tam}`).textContent = saidaTemp[tam]
      } else if (qty === 'ret') {
        retornoTemp[tam] = Math.max(0, retornoTemp[tam] + Number(delta))
        document.getElementById(`qty-ret-${tam}`).textContent = retornoTemp[tam]
      }
    })
  })

  if (tab === 'barracas') {
    document.getElementById('btn-add-barraca').addEventListener('click', addBarraca)
    document.querySelectorAll('[data-del-barraca]').forEach(btn => {
      btn.addEventListener('click', () => deleteBarraca(btn.dataset.delBarraca))
    })
  }
  if (tab === 'estoque') {
    document.getElementById('btn-salvar-estoque').addEventListener('click', salvarEstoque)
  }
  if (tab === 'saida') {
    document.getElementById('btn-confirmar-saida').addEventListener('click', confirmarSaida)
  }
  if (tab === 'retorno') {
    document.getElementById('btn-confirmar-retorno').addEventListener('click', confirmarRetorno)
  }
}

// ── Actions ───────────────────────────────────────────────────────
async function addBarraca() {
  const nome = document.getElementById('input-barraca').value.trim()
  const responsavel = document.getElementById('input-responsavel').value.trim()
  if (!nome) { toast('Informe o nome da barraca'); return }
  const btn = document.getElementById('btn-add-barraca')
  btn.disabled = true; btn.textContent = 'Salvando…'
  const { error } = await supabase.from('barracas').insert({ nome, responsavel })
  if (error) { toast('Erro ao salvar'); btn.disabled = false; btn.textContent = '＋ Cadastrar barraca'; return }
  toast('Barraca cadastrada!')
}

async function deleteBarraca(id) {
  const { error } = await supabase.from('barracas').delete().eq('id', id)
  if (error) toast('Erro ao remover')
  else toast('Barraca removida')
}

async function salvarEstoque() {
  const btn = document.getElementById('btn-salvar-estoque')
  btn.disabled = true; btn.textContent = 'Salvando…'
  const { data: existing } = await supabase.from('estoque').select('id').limit(1).maybeSingle()
  const payload = { p: estoqueEdit.p, m: estoqueEdit.m, g: estoqueEdit.g }
  let error
  if (existing) {
    ({ error } = await supabase.from('estoque').update(payload).eq('id', existing.id))
  } else {
    ({ error } = await supabase.from('estoque').insert(payload))
  }
  if (error) { toast('Erro ao salvar estoque'); btn.disabled = false; btn.textContent = '💾 Salvar estoque inicial'; return }
  estoqueInicial = { ...estoqueEdit }
  recalcSaldo()
  toast('Estoque salvo!')
  renderTab('estoque')
}

async function confirmarSaida() {
  const barracaId = document.getElementById('sel-barraca-saida').value
  const por = document.getElementById('input-por').value.trim()
  if (!barracaId) { toast('Selecione a barraca'); return }
  const { p, m, g } = saidaTemp
  if (!p && !m && !g) { toast('Informe ao menos 1 prenda'); return }
  if (p > saldo.p || m > saldo.m || g > saldo.g) { toast('Quantidade maior que o saldo!'); return }
  const btn = document.getElementById('btn-confirmar-saida')
  btn.disabled = true; btn.textContent = 'Registrando…'
  const { error } = await supabase.from('movimentos').insert({
    barraca_id: barracaId, tipo: 'saida', qtd_p: p, qtd_m: m, qtd_g: g, retirado_por: por
  })
  if (error) { toast('Erro ao registrar'); btn.disabled = false; btn.textContent = '→ Confirmar saída'; return }
  saidaTemp = { p: 0, m: 0, g: 0 }
  toast('Saída registrada!')
}

async function confirmarRetorno() {
  const barracaId = document.getElementById('sel-barraca-retorno').value
  if (!barracaId) { toast('Selecione a barraca'); return }
  const { p, m, g } = retornoTemp
  if (!p && !m && !g) { toast('Informe ao menos 1 prenda'); return }
  const btn = document.getElementById('btn-confirmar-retorno')
  btn.disabled = true; btn.textContent = 'Registrando…'
  const { error } = await supabase.from('movimentos').insert({
    barraca_id: barracaId, tipo: 'retorno', qtd_p: p, qtd_m: m, qtd_g: g, retirado_por: null
  })
  if (error) { toast('Erro ao registrar'); btn.disabled = false; btn.textContent = '← Confirmar retorno'; return }
  retornoTemp = { p: 0, m: 0, g: 0 }
  toast('Retorno registrado!')
}

// ── Start ─────────────────────────────────────────────────────────
boot()
