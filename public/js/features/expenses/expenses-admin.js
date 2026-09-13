let expensesReady = false;
let expensesRowsById = new Map();

async function loadExpensesAdmin() {
  const panel = document.getElementById('admin-expenses-admin');
  if (!panel) return;
  const today = businessDate();
  const form = document.getElementById('expenses-form');
  if (!form.elements.expense_date.value) form.elements.expense_date.value = today;
  for (const id of ['expenses-from', 'expenses-to']) {
    const input = document.getElementById(id);
    if (!input.value) input.value = today;
  }
  if (!expensesReady) {
    expensesReady = true;
    form.addEventListener('submit', saveShopExpense);
    document.getElementById('expenses-load').addEventListener('click', loadShopExpenses);
    document.getElementById('expenses-print-report').addEventListener('click', printShopExpensesReport);
    document.getElementById('expenses-rows').addEventListener('click', event => {
      const button = event.target.closest('[data-expense-receipt]');
      if (!button) return;
      const row = expensesRowsById.get(Number(button.dataset.expenseReceipt));
      if (row) printShopExpenseReceipt(row);
    });
  }
  try {
    const cashiers = await api('/api/cashiers');
    const select = document.getElementById('expenses-cashier');
    const previous = select.value;
    select.replaceChildren(new Option(t('expenses_choose_cashier'), ''));
    cashiers.filter(c => c.active).forEach(c => select.add(new Option(`${c.name} (${c.code})`, c.id)));
    if (previous) select.value = previous;
    if (!select.value && currentUser?.cashier_code) {
      const own = cashiers.find(c => c.code === currentUser.cashier_code);
      if (own) select.value = String(own.id);
    }
    await loadShopExpenses();
  } catch (error) { toast(error.message || t('expenses_load_failed'), 'error'); }
}

async function fetchShopExpenses() {
  const from = document.getElementById('expenses-from').value;
  const to = document.getElementById('expenses-to').value;
  if (!from || !to || from > to) throw new Error(t('expenses_invalid_period'));
  return api(`/api/expenses?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}

async function loadShopExpenses() {
  try {
    const result = await fetchShopExpenses();
    expensesRowsById = new Map(result.items.map(row => [Number(row.id), row]));
    const currency = escapeHtml(getCurrency());
    document.getElementById('expenses-total').textContent = `${Number(result.total || 0).toFixed(2)} ${getCurrency()}`;
    document.getElementById('expenses-rows').innerHTML = result.items.length ? result.items.map(row => `
      <tr><td><strong>${shopExpenseNumber(row.id)}</strong></td><td>${escapeHtml(row.expense_date)}</td>
      <td>${escapeHtml(row.title)}<small style="display:block;color:#746b70">${t(`expenses_category_${row.category}`)}</small></td>
      <td>${escapeHtml(row.cashier_name)} (${escapeHtml(row.cashier_code)})</td>
      <td>${t(`expenses_payment_${row.payment_method}`)}</td><td><strong>${Number(row.amount).toFixed(2)} ${currency}</strong></td>
      <td><button class="expenses-button expenses-button-light" type="button" data-expense-receipt="${Number(row.id)}">${t('expenses_print_receipt')}</button></td></tr>`).join('')
      : `<tr><td colspan="7">${t('expenses_empty')}</td></tr>`;
  } catch (error) { toast(error.message || t('expenses_load_failed'), 'error'); }
}

async function saveShopExpense(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const button = document.getElementById('expenses-save');
  const body = Object.fromEntries(new FormData(form));
  body.cashier_id = Number(body.cashier_id);
  body.amount = Number(body.amount);
  button.disabled = true;
  try {
    const row = await api('/api/expenses', 'POST', body);
    toast(t('expenses_saved'), 'success');
    form.reset();
    form.elements.expense_date.value = businessDate();
    await loadShopExpenses();
    printShopExpenseReceipt(row);
  } catch (error) { toast(error.message || t('expenses_save_failed'), 'error'); }
  finally { button.disabled = false; }
}

async function printShopExpensesReport() {
  try { printShopExpensesReportPage(await fetchShopExpenses()); }
  catch (error) { toast(error.message || t('expenses_load_failed'), 'error'); }
}
