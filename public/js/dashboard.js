let salesTrendChartInstance = null;
let paymentMethodChartInstance = null;
let employeeSalesChartInstance = null;

async function loadDashboard() {
  const from = document.getElementById('dash-from').value;
  const to = document.getElementById('dash-to').value;
  const empId = document.getElementById('dash-employee-filter').value;
  
  try {
    let url = `/api/reports/sales?from=${from}&to=${to}`;
    if (empId) url += `&employee_id=${empId}`;
    
    const data = await api(url);
    
    renderSalesTrendChart(data.daily);
    renderPaymentMethodChart(data.by_payment);
    renderEmployeeSalesChart(data.by_employee);
  } catch (err) {
    console.error('Failed to load dashboard:', err);
    toast(t('error') + ': ' + (err.message || ''), 'error');
  }
}

function renderSalesTrendChart(dailyData) {
  const ctx = document.getElementById('salesTrendChart').getContext('2d');
  
  if (salesTrendChartInstance) {
    salesTrendChartInstance.destroy();
  }
  
  const labels = dailyData.map(d => d.day);
  const revenue = dailyData.map(d => d.revenue);
  
  salesTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'الإيرادات اليومية (Daily Revenue)',
        data: revenue,
        borderColor: '#6b1124',
        backgroundColor: 'rgba(107, 17, 36, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'اتجاه المبيعات (Sales Trend)' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function renderPaymentMethodChart(paymentData) {
  const ctx = document.getElementById('paymentMethodChart').getContext('2d');
  
  if (paymentMethodChartInstance) {
    paymentMethodChartInstance.destroy();
  }
  
  const labels = paymentData.map(d => t('pay_' + d.payment_method) || d.payment_method);
  const data = paymentData.map(d => d.total);
  
  paymentMethodChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#4caf50', '#2196f3', '#ff9800', '#f44336', '#9c27b0']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'right' },
        title: { display: true, text: 'طرق الدفع (Payment Methods)' }
      }
    }
  });
}

function renderEmployeeSalesChart(employeeData) {
  const ctx = document.getElementById('employeeSalesChart').getContext('2d');
  
  if (employeeSalesChartInstance) {
    employeeSalesChartInstance.destroy();
  }
  
  const labels = employeeData.map(d => d.employee_name || 'الكاشير');
  const data = employeeData.map(d => d.total);
  
  employeeSalesChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'المبيعات حسب الموظف (Sales by Employee)',
        data: data,
        backgroundColor: '#6b1124'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'أداء الموظفين (Employee Performance)' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// Ensure the dashboard loads when the view is opened
document.addEventListener('DOMContentLoaded', () => {
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.view === 'dashboard') {
        const today = businessDate();
        document.getElementById('dash-from').value = today;
        document.getElementById('dash-to').value = today;
        
        // Load employee filter options
        const empSelect = document.getElementById('dash-employee-filter');
        if (empSelect && empSelect.options.length <= 1) {
          try {
            const emps = await api('/api/employees');
            emps.forEach(e => {
              empSelect.innerHTML += `<option value="${e.id}">${escapeHtml(e.name)}</option>`;
            });
          } catch (err) {
            console.error('Failed to load employees for dashboard filter:', err);
          }
        }
        
        loadDashboard();
      }
    });
  });
});
