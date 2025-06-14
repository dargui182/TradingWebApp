// Dashboard JavaScript Functions

document.addEventListener('DOMContentLoaded', function() {
    // Initialize dashboard
    initializeDashboard();
    
    // Setup event listeners
    setupEventListeners();
    
    // Start auto-refresh if enabled
    startAutoRefresh();
});

// Initialize dashboard components
function initializeDashboard() {
    console.log('Dashboard initialized');
    
    // Add fade-in animation to cards
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
        card.classList.add('fade-in');
    });
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
}

// Setup event listeners
function setupEventListeners() {
    // Refresh button
    const refreshButtons = document.querySelectorAll('[data-action="refresh"]');
    refreshButtons.forEach(button => {
        button.addEventListener('click', refreshDashboard);
    });
    
    // Export button
    const exportButtons = document.querySelectorAll('[data-action="export"]');
    exportButtons.forEach(button => {
        button.addEventListener('click', exportData);
    });
    
    // Quick action buttons
    const quickActionButtons = document.querySelectorAll('.btn-outline-primary, .btn-outline-success, .btn-outline-info, .btn-outline-warning');
    quickActionButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const action = this.textContent.trim();
            showNotification(`Azione "${action}" eseguita!`, 'success');
        });
    });
    
    // Search functionality
    const searchInputs = document.querySelectorAll('input[type="search"]');
    searchInputs.forEach(input => {
        input.addEventListener('input', debounce(handleSearch, 300));
    });
    
    // Theme toggle (if needed)
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

// Create activity element
function createActivityElement(activity) {
    const div = document.createElement('div');
    div.className = 'd-flex align-items-center mb-3';
    
    const iconClass = activity.type === 'success' ? 'bg-success bi-check' :
                     activity.type === 'info' ? 'bg-info bi-info' :
                     'bg-warning bi-exclamation';
    
    div.innerHTML = `
        <div class="me-3">
            <div class="${iconClass.split(' ')[0]} rounded-circle d-flex align-items-center justify-content-center" style="width: 35px; height: 35px;">
                <i class="bi ${iconClass.split(' ')[1]} text-white"></i>
            </div>
        </div>
        <div class="flex-grow-1">
            <div class="small text-gray-500">${activity.time}</div>
            <div>${activity.action}</div>
        </div>
    `;
    
    return div;
}

// Real export function
async function exportData() {
    showNotification('Preparazione export...', 'info');
    
    try {
        const [statsResponse, activitiesResponse] = await Promise.all([
            fetch('/api/stats'),
            fetch('/api/activities')
        ]);
        
        const stats = await statsResponse.json();
        const activities = await activitiesResponse.json();
        
        const exportData = {
            timestamp: new Date().toISOString(),
            dashboard_stats: stats,
            recent_activities: activities,
            export_info: {
                version: '1.0',
                exported_by: 'Dashboard Export Tool'
            }
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Export completato!', 'success');
    } catch (error) {
        console.error('Errore export:', error);
        showNotification('Errore durante l\'export', 'danger');
    }
}

// Enhanced animate number function
function animateNumber(element, startValue, endValue, withThousandsSeparator = false, suffix = '') {
    const duration = 1000;
    const startTime = Date.now();
    
    function updateNumber() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currentValue = startValue + (endValue - startValue) * easeOutQuart(progress);
        
        let formattedValue = Math.floor(currentValue).toString();
        
        if (withThousandsSeparator) {
            formattedValue = formattedValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        }
        
        element.textContent = formattedValue + suffix;
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        }
    }
    
    updateNumber();
}


// Easing function
function easeOutQuart(t) {
    return 1 - (--t) * t * t * t;
}

// Real dashboard refresh
async function refreshDashboard() {
    showNotification('Aggiornamento dati...', 'info');
    
    const refreshBtns = document.querySelectorAll('[data-action="refresh"]');
    refreshBtns.forEach(btn => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Aggiornamento...';
        btn.disabled = true;
    });
    
    try {
        // Fetch real data
        const [statsResponse, activitiesResponse] = await Promise.all([
            fetch('/api/stats'),
            fetch('/api/activities')
        ]);
        
        if (statsResponse.ok && activitiesResponse.ok) {
            const stats = await statsResponse.json();
            const activities = await activitiesResponse.json();
            
            // Update statistics in real time
            updateRealStatistics(stats);
            updateRealActivities(activities);
            
            showNotification('Dati aggiornati con successo!', 'success');
        } else {
            throw new Error('Errore nel recuperare i dati');
        }
    } catch (error) {
        console.error('Errore refresh:', error);
        showNotification('Errore nell\'aggiornamento dati', 'danger');
    } finally {
        refreshBtns.forEach(btn => {
            btn.innerHTML = btn.dataset.originalText || '<i class="bi bi-arrow-clockwise me-1"></i>Aggiorna';
            btn.disabled = false;
        });
    }
}
// Update real activities
function updateRealActivities(activities) {
    const activitiesContainer = document.querySelector('.card-body .d-flex.align-items-center').parentNode;
    if (!activitiesContainer) return;
    
    // Clear existing activities (keep the "Vedi tutte" button)
    const existingActivities = activitiesContainer.querySelectorAll('.d-flex.align-items-center.mb-3');
    existingActivities.forEach(activity => activity.remove());
    
    // Add new activities
    activities.slice(0, 5).forEach(activity => {
        const activityElement = createActivityElement(activity);
        activitiesContainer.insertBefore(activityElement, activitiesContainer.lastElementChild);
    });
}

// Update real statistics
function updateRealStatistics(stats) {
    const statMapping = {
        'total_tickers': document.querySelector('.border-left-primary .h5'),
        'updated_tickers': document.querySelector('.border-left-success .h5'),
        'total_records': document.querySelector('.border-left-info .h5'),
        'total_size_mb': document.querySelector('.border-left-warning .h5')
    };
    
    Object.entries(statMapping).forEach(([key, element]) => {
        if (element && stats[key] !== undefined) {
            const currentValue = parseFloat(element.textContent.replace(/[^0-9.-]+/g, '')) || 0;
            const newValue = stats[key];
            
            if (key === 'total_records') {
                animateNumber(element, currentValue, newValue, true); // Con separatori migliaia
            } else if (key === 'total_size_mb') {
                animateNumber(element, currentValue, newValue, false, ' MB');
            } else {
                animateNumber(element, currentValue, newValue);
            }
        }
    });
}

// Search functionality
function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    console.log('Searching for:', query);
    
    // Here you would implement actual search logic
    // For now, just show a notification
    if (query.length > 2) {
        showNotification(`Ricerca per: "${query}"`, 'info');
    }
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.toast-notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show toast-notification`;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Auto-refresh functionality
function startAutoRefresh() {
    const autoRefreshInterval = 300000; // 5 minutes
    
    setInterval(() => {
        // Only refresh if page is visible
        if (!document.hidden) {
            console.log('Auto-refreshing dashboard data...');
            fetchLatestData();
        }
    }, autoRefreshInterval);
}

// ✅ AGGIORNARE fetchLatestData per usare endpoint reali:
async function fetchLatestData() {
    try {
        const [statsResponse, activitiesResponse] = await Promise.all([
            fetch('/api/stats'),
            fetch('/api/activities')
        ]);
        
        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            updateRealStatistics(stats);
            console.log('Stats updated:', stats);
        }
        
        if (activitiesResponse.ok) {
            const activities = await activitiesResponse.json();
            updateRealActivities(activities);
            console.log('Activities updated:', activities);
        }
    } catch (error) {
        console.error('Error fetching latest data:', error);
    }
}

// Theme toggle functionality
function toggleTheme() {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    
    if (isDark) {
        body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}

// Load saved theme
function loadSavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }
}

// Utility functions
const Utils = {
    // Format numbers with thousands separator
    formatNumber: function(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },
    
    // Format currency
    formatCurrency: function(amount, currency = '€') {
        return `${currency}${this.formatNumber(amount.toFixed(2))}`;
    },
    
    // Format date
    formatDate: function(date) {
        return new Intl.DateTimeFormat('it-IT', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    },
    
    // Copy text to clipboard
    copyToClipboard: async function(text) {
        try {
            await navigator.clipboard.writeText(text);
            showNotification('Copiato negli appunti!', 'success');
        } catch (err) {
            console.error('Failed to copy: ', err);
            showNotification('Errore durante la copia', 'error');
        }
    }
};

// Make Utils available globally
window.DashboardUtils = Utils;

// Load theme on page load
loadSavedTheme();