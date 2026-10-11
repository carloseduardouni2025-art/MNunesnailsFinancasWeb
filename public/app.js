const $ = selector => document.querySelector(selector);
const state = { view: 'dashboard', clients: [], services: [], transactions: [] };
const money = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const titles = { dashboard: ['Olá!', 'Veja o resumo financeiro do seu salão.'], transactions: ['Receitas e despesas', 'Registre entradas e saídas e acompanhe cada movimento.'], clients: ['Clientes', 'Quem confia no seu cuidado, sempre por perto.'], services: ['Serviços', 'Mantenha os serviços do seu salão organizados.'] };
const names = { transactions: 'lançamento', clients: 'cliente', services: 'serviço' };
$('#month-filter').value = today().slice(0, 7);
async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, { ...options, headers: { 'Content-Type': 'application/json' } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os dados.');
  return data;
}
function notice(message) { $('#notice').textContent = message; $('#notice').hidden = !message; }
async function load() {
  const results = await Promise.all(['clients', 'services', 'transactions'].map(key => api(key)));
  ['clients', 'services', 'transactions'].forEach((key, index) => state[key] = results[index]);
  render();
}
function empty(title, text) { return `<div class="empty"><b>${title}</b><p>${text}</p></div>`; }
function transactionTable(rows, actions) {
  if (!rows.length) return empty('Tudo começa com o primeiro registro', 'Adicione um lançamento para acompanhar suas finanças neste mês.');
  return `<div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Data</th><th>Categoria</th><th>Valor</th>${actions ? '<th>Ações</th>' : ''}</tr></thead><tbody>${rows.map(row => `<tr><td>${escape(row.description)}${row.client_id ? `<br><small>${escape(state.clients.find(client => client.id === row.client_id)?.name || '')}</small>` : ''}</td><td>${row.date.split('-').reverse().join('/')}</td><td><span class="badge">${escape(row.category)}</span></td><td class="${row.type}">${row.type === 'income' ? '+' : '−'} ${money(row.amount)}</td>${actions ? `<td><button class="delete" data-delete="${row.id}" aria-label="Excluir ${escape(row.description)}">Excluir</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}
function render() {
  const [title, description] = titles[state.view];
  $('#page-title').textContent = title; $('#page-description').textContent = description;
  $('#add-button').textContent = `+ Novo ${names[state.view] || 'lançamento'}`;
  document.querySelectorAll('[data-view]').forEach(button => { const active = button.dataset.view === state.view; button.classList.toggle('active', active); active ? button.setAttribute('aria-current', 'page') : button.removeAttribute('aria-current'); });
  $('.toolbar').hidden = ['clients', 'services'].includes(state.view);
  const rows = state.transactions.filter(row => row.date.startsWith($('#month-filter').value)).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  if (state.view === 'dashboard') {
    const income = rows.filter(row => row.type === 'income').reduce((sum, row) => sum + row.amount, 0);
    const expense = rows.filter(row => row.type === 'expense').reduce((sum, row) => sum + row.amount, 0);
    const totalIncome = state.transactions.filter(row => row.type === 'income').reduce((sum, row) => sum + row.amount, 0);
    $('#content').innerHTML = `<div class="dashboard-top"><div class="cards"><article class="card"><span class="card-icon">＄</span><div><p>Receitas do mês</p><strong class="pink">${money(income)}</strong><small>Recebimentos no período</small></div></article><article class="card"><span class="card-icon">▦</span><div><p>Total de receitas</p><strong>${money(totalIncome)}</strong><small>Todos os meses</small></div></article><article class="card"><span class="card-icon">✂</span><div><p>Serviços cadastrados</p><strong>${state.services.length}</strong><small>Seu catálogo de serviços</small></div></article></div><div class="beauty-art" aria-hidden="true"><span>Beleza<br>também é<br>resultado ♡</span><div class="nail nail-one"></div><div class="nail nail-two"></div><div class="nail nail-three"></div></div></div><div class="dashboard-grid"><div><section class="panel quick-panel"><div class="panel-heading"><h2>Ações rápidas</h2></div><div class="quick-actions"><button data-create="transactions"><i>⊕</i><span>Registrar<br>Receita</span></button><button data-create="services"><i>✂</i><span>Cadastrar<br>Serviço</span></button><button data-go="transactions"><i>▤</i><span>Consultar<br>Registros</span></button><button data-summary><i>▥</i><span>Ver Resumo</span></button></div></section><div class="quote"><span class="quote-mark">“</span><p>Organização hoje,<br>mais conquistas amanhã. <span>♡</span></p></div></div><section class="panel recent-panel"><div class="panel-heading"><h2>Últimos lançamentos</h2><button class="text-button" data-go="transactions">Ver todos</button></div>${transactionTable(rows.slice(0, 5), false)}</section></div><section class="monthly-summary" id="monthly-summary"><div>Entradas <strong class="income">${money(income)}</strong></div><div>Saídas <strong class="expense">${money(expense)}</strong></div><div>Saldo do mês <strong>${money(income - expense)}</strong></div></section>`;
  } else if (state.view === 'transactions') {
    $('#content').innerHTML = `<section class="panel"><div class="panel-heading"><h2>Movimentações</h2><small>${rows.length} registro(s)</small></div>${transactionTable(rows, true)}</section>`;
  } else {
    const clients = state.view === 'clients'; const records = state[state.view];
    $('#content').innerHTML = `<section class="panel"><div class="panel-heading"><h2>${title} cadastrados</h2><small>${records.length} registro(s)</small></div>${records.length ? `<div class="table-wrap"><table><thead><tr><th>Nome</th><th>${clients ? 'Telefone' : 'Preço'}</th><th>Ações</th></tr></thead><tbody>${records.map(row => `<tr><td>${escape(row.name)}</td><td>${clients ? escape(row.phone || '—') : money(row.price)}</td><td><button class="delete" data-delete="${row.id}" aria-label="Excluir ${escape(row.name)}">Excluir</button></td></tr>`).join('')}</tbody></table></div>` : empty(clients ? 'Um espaço para suas clientes' : 'Cada serviço tem seu valor', `Cadastre o primeiro ${names[state.view]} usando o botão acima.`)}</section>`;
  }
  // Keep table semantics while presenting each record as a labeled card on phones.
  document.querySelectorAll('#content table').forEach(table => {
    table.setAttribute('role', 'table');
    const headings = [...table.querySelectorAll('th')];
    headings.forEach(heading => { heading.scope = 'col'; heading.setAttribute('role', 'columnheader'); });
    table.querySelectorAll('thead, tbody').forEach(group => group.setAttribute('role', 'rowgroup'));
    table.querySelectorAll('tr').forEach(row => row.setAttribute('role', 'row'));
    table.querySelectorAll('tbody tr').forEach(row => {
      [...row.cells].forEach((cell, index) => {
        cell.setAttribute('role', 'cell');
        const value = document.createElement('span');
        value.className = 'cell-value';
        value.append(...cell.childNodes);
        const label = document.createElement('span');
        label.className = 'mobile-cell-label';
        label.setAttribute('aria-hidden', 'true');
        label.textContent = headings[index].textContent;
        cell.append(label, value);
      });
    });
  });
}
function navigate(view) { state.view = view; notice(''); render(); }
document.querySelector('nav').addEventListener('click', event => { const button = event.target.closest('[data-view]'); if (button) navigate(button.dataset.view); });
$('#month-filter').addEventListener('change', render);
$('#content').addEventListener('click', async event => {
  const create = event.target.closest('[data-create]'); if (create) return openForm(create.dataset.create);
  if (event.target.closest('[data-summary]')) { $('#monthly-summary').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#monthly-summary').classList.remove('highlight'); requestAnimationFrame(() => $('#monthly-summary').classList.add('highlight')); return; }
  const go = event.target.closest('[data-go]'); if (go) return navigate(go.dataset.go);
  const button = event.target.closest('[data-delete]');
  if (!button || !confirm('Excluir este registro? Esta ação não pode ser desfeita.')) return;
  button.disabled = true;
  try { await api(`${state.view}/${button.dataset.delete}`, { method: 'DELETE' }); await load(); notice('Registro excluído.'); }
  catch (error) { notice(error.message); button.disabled = false; }
});
let formResource;
function openForm(resource) {
  formResource = resource;
  $('#record-form').reset(); $('#form-error').textContent = '';
  $('#dialog-title').textContent = formResource === 'services' ? 'Cadastrar Serviço' : formResource === 'transactions' ? 'Registrar Receita ou Despesa' : 'Cadastrar Cliente';
  $('#form-tip').innerHTML = `<div class="tip-art" aria-hidden="true">${formResource === 'services' ? '✂' : formResource === 'transactions' ? '＄' : '♡'}</div><h3>${formResource === 'services' ? 'Cadastre seus serviços' : formResource === 'transactions' ? 'Registre suas receitas' : 'Cuide de cada conexão'}</h3><p>${formResource === 'services' ? 'Mantenha seus serviços organizados e facilite o registro das receitas.' : formResource === 'transactions' ? 'Acompanhe seus recebimentos e gastos de forma simples e organizada.' : 'Tenha os contatos de suas clientes sempre por perto.'}</p>`;
  $('#form-fields').innerHTML = formResource === 'clients' ? '<label>Nome<input name="name" required maxlength="200" autocomplete="name"></label><label>Telefone (opcional)<input name="phone" type="tel" maxlength="200" autocomplete="tel"></label>' : formResource === 'services' ? '<label>Nome do serviço<input name="name" required maxlength="200"></label><label>Preço (R$)<input name="price" type="number" min="0" step="0.01" required></label>' : `<label>Descrição<input name="description" required maxlength="200"></label><label>Tipo<select name="type"><option value="income">Entrada</option><option value="expense">Saída</option></select></label><label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Data<input name="date" type="date" value="${today()}" required></label><label>Categoria<select name="category"><option>Atendimento</option><option>Produtos</option><option>Materiais</option><option>Aluguel</option><option>Outros</option></select></label><label>Cliente (opcional)<select name="client_id"><option value="">Sem cliente</option>${state.clients.map(client => `<option value="${client.id}">${escape(client.name)}</option>`).join('')}</select></label>`;
  $('#form-fields').querySelectorAll('input[type="number"]').forEach(input => { input.inputMode = 'decimal'; });
  $('#form-dialog').showModal(); $('#form-fields input').focus();
}
$('#add-button').addEventListener('click', () => openForm(state.view === 'dashboard' ? 'transactions' : state.view));
for (const selector of ['#close-dialog', '#cancel-dialog']) $(selector).addEventListener('click', () => $('#form-dialog').close());
$('#record-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = $('#record-form button[type="submit"]'); button.disabled = true; $('#form-error').textContent = '';
  const body = Object.fromEntries(new FormData(event.target));
  for (const key of ['price', 'amount']) if (key in body) body[key] = Math.round(Number(body[key]) * 100);
  if ('client_id' in body) body.client_id = body.client_id ? Number(body.client_id) : null;
  try { await api(formResource, { method: 'POST', body: JSON.stringify(body) }); if (body.date) $('#month-filter').value = body.date.slice(0, 7); $('#form-dialog').close(); await load(); notice('Registro salvo com sucesso.'); }
  catch (error) { $('#form-error').textContent = error.message; }
  finally { button.disabled = false; }
});
load().catch(error => { $('#content').innerHTML = empty('Não foi possível carregar os dados', 'Verifique se o servidor está em execução e recarregue a página.'); notice(error.message); });
