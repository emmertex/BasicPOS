const leftPanel = document.getElementById('left-panel');
const parkedSalesSection = document.getElementById('parked-sales-section');
const itemSearchResultsContainer = document.getElementById('item-search-results-container');
const itemSearchResultsDiv = document.getElementById('item-search-results'); // Used by collapseItemSearchResults
const itemSearchInput = document.getElementById('item-search-input'); // Used by collapseItemSearchResults
const quickAddDashboardSection = document.getElementById('quick-add-dashboard-section');

export function shrinkLeftPanel() {
    if (leftPanel) {
        leftPanel.classList.add('shrunk');
    }
}

export function expandLeftPanel() {
    if (leftPanel) {
        leftPanel.classList.remove('shrunk');
    }
}

export function collapseParkedSales() {
    if (parkedSalesSection) {
        parkedSalesSection.classList.add('collapsed');
    }
}

export function expandParkedSales() {
    if (parkedSalesSection) {
        parkedSalesSection.classList.remove('collapsed');
    }
}

export function expandItemSearchResults() {
    if (itemSearchResultsContainer) {
        itemSearchResultsContainer.classList.add('expanded');
        collapseQuickAddDashboard(); // Inner dependency
    }
}

export function collapseItemSearchResults() {
    if (itemSearchResultsContainer) {
        itemSearchResultsContainer.classList.remove('expanded');
        if (itemSearchResultsDiv) itemSearchResultsDiv.innerHTML = '';
        if (itemSearchInput) itemSearchInput.value = '';
        expandQuickAddDashboard(); // Inner dependency
    }
}

export function collapseQuickAddDashboard() {
    if (quickAddDashboardSection) {
        quickAddDashboardSection.classList.add('collapsed');
    }
}

export function expandQuickAddDashboard() {
    if (quickAddDashboardSection) {
        quickAddDashboardSection.classList.remove('collapsed');
    }
} 