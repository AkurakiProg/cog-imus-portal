// public/js/analytics.js
// Can be imported on any page that needs to render finance charts.

function renderFinanceCharts(summary, trends, breakdown) {
    // Format currency for axes
    const formatCurrency = (value) => {
        if (value >= 1000000) return '₱' + (value / 1000000).toFixed(1) + 'M';
        if (value >= 1000) return '₱' + (value / 1000).toFixed(1) + 'K';
        return '₱' + value;
    };

    // Render Trends Chart
    const trendsCtx = document.getElementById('trendsChart');
    if (trendsCtx) {
        if (window.trendsChartInstance) window.trendsChartInstance.destroy();
        window.trendsChartInstance = new Chart(trendsCtx.getContext('2d'), {
            type: 'line',
            data: {
                labels: trends.map(t => t.month),
                datasets: [
                    { label: 'Income', data: trends.map(t => t.income), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 },
                    { label: 'Expense', data: trends.map(t => t.expense), borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: (v) => formatCurrency(v) }, grid: { color: '#f1f5f9' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // Render Breakdown Doughnut Chart
    const breakdownCtx = document.getElementById('breakdownChart');
    if (breakdownCtx) {
        if (window.breakdownChartInstance) window.breakdownChartInstance.destroy();
        const expenses = breakdown.filter(b => b.transaction_type === 'Expense');
        window.breakdownChartInstance = new Chart(breakdownCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: expenses.map(e => e.category_name),
                datasets: [{
                    data: expenses.map(e => e.total_amount),
                    backgroundColor: ['#ef4444', '#f59e0b', '#f97316', '#eab308', '#84cc16', '#10b981', '#06b6d4'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '65%' }
        });
    }
}