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

// Refresh dashboard data
function refreshDashboard() {
    showNotification('Aggiornamento dati...', 'info');
    
    // Show loading state
    const refreshBtns = document.querySelectorAll('[data-action="refresh"]');
    refreshBtns.forEach(btn => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Aggiornamento...';
        btn.disabled = true;
        
        // Simulate API call
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            showNotification('Dati aggiornati con successo!', 'success');
            
            // Refresh statistics (simulate)
            updateStatistics();
        }, 2000);
    });
}

// Update statistics with animation
function updateStatistics() {
    const statElements = document.querySelectorAll('.h5.mb-0.font-weight-bold');
    
    statElements.forEach(element => {
        const currentValue = parseFloat(element.textContent.replace(/[^0-9.-]+/g, ''));
        const newValue = currentValue + Math.floor(Math.random() * 100) - 50;
        
        // Animate number change
        animateNumber(element, currentValue, Math.max(0, newValue));
    });
}

// Animate number changes
function animateNumber(element, startValue, endValue) {
    const duration = 1000;
    const startTime = Date.now();
    const isEuro = element.textContent.includes('€');
    const hasComma = element.textContent.includes(',');
    
    function updateNumber() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currentValue = startValue + (endValue - startValue) * easeOutQuart(progress);
        
        let formattedValue = Math.floor(currentValue).toString();
        
        if (hasComma) {
            formattedValue = formattedValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        }
        
        if (isEuro) {
            formattedValue = '€' + formattedValue + '.00';
        }
        
        element.textContent = formattedValue;
        
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

// Export data functionality
function exportData() {
    showNotification('Preparazione export...', 'info');
    
    // Simulate export process
    setTimeout(() => {
        const data = {
            timestamp: new Date().toISOString(),
            statistics: {
                users: 1234,
                sales: 45678.90,
                sessions: 89,
                conversion: 12.5
            }
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Export completato!', 'success');
    }, 1500);
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

// Fetch latest data from API
async function fetchLatestData() {
    try {
        // Fetch statistics
        const statsResponse = await fetch('/api/stats');
        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            // Update UI with new stats
            console.log('Stats updated:', stats);
        }
        
        // Fetch activities
        const activitiesResponse = await fetch('/api/activities');
        if (activitiesResponse.ok) {
            const activities = await activitiesResponse.json();
            // Update activities feed
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