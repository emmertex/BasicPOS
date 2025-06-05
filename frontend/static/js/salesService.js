import { apiCall } from './apiService.js';
import { showToast } from './toastService.js';
import { state } from './uiState.js';
import { loadSaleIntoCart, updateCartDisplay } from './cart.js';
import { openPrintOptionsModal } from './printService.js'; // Import for print button

// --- DOM Element Selectors ---
let searchSaleIdInput;
let searchSaleCustomerInput;
let searchSaleStatusSelect;
let searchSalesButton;
let allSalesSearchResultsDiv;
let parkedSalesListDiv;

export function initSalesService() {
    // All Sales Search
    searchSaleIdInput = document.getElementById('search-sale-id');
    searchSaleCustomerInput = document.getElementById('search-sale-customer');
    searchSaleStatusSelect = document.getElementById('search-sale-status');
    searchSalesButton = document.getElementById('search-sales-button');
    allSalesSearchResultsDiv = document.getElementById('all-sales-search-results');

    // Parked Sales
    parkedSalesListDiv = document.getElementById('parked-sales-list');

    // Event Listeners
    if (searchSalesButton) {
        searchSalesButton.addEventListener('click', searchAllSales);
    }
    if (searchSaleIdInput) {
        searchSaleIdInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') searchAllSales();
        });
    }
    if (searchSaleCustomerInput) {
        searchSaleCustomerInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') searchAllSales();
        });
    }
    if (searchSaleStatusSelect) {
        searchSaleStatusSelect.addEventListener('change', searchAllSales);
    }

    // Initial load of parked sales can be triggered from app.js after all services are initialized.
    // Or, if it should always load on init of this service:
    // loadParkedSales(); 
}

export async function loadParkedSales() {
    if (!parkedSalesListDiv) {
        console.warn("Parked sales list div not found. Cannot load parked sales.");
        return;
    }
    parkedSalesListDiv.innerHTML = '<p>Loading parked sales...</p>';
    try {
        const sales = await apiCall('/sales/status/Open'); // Assuming 'Open' is the status for parked sales
        console.log("Fetched parked sales:", sales);
        parkedSalesListDiv.innerHTML = '';
        if (sales && sales.length > 0) {
            sales.forEach(sale => {
                const saleDiv = document.createElement('div');
                saleDiv.className = 'parked-sale-entry';
                const totalDisplay = sale.sale_total !== undefined && sale.sale_total !== null ? sale.sale_total.toFixed(2) : '0.00';
                saleDiv.innerHTML = 'Sale ID: ' + sale.id + ' - Customer: ' + (sale.customer ? sale.customer.name : 'N/A') + ' - Total: ' + totalDisplay;
                saleDiv.style.cursor = 'pointer';
                saleDiv.style.padding = '5px';
                saleDiv.style.borderBottom = '1px solid #eee';
                saleDiv.onclick = () => {
                    const currentlySelected = parkedSalesListDiv.querySelector('.parked-sale-entry.selected');
                    if (currentlySelected) {
                        currentlySelected.classList.remove('selected');
                    }
                    saleDiv.classList.add('selected');
                    loadSaleIntoCart(sale.id);
                };
                parkedSalesListDiv.appendChild(saleDiv);
            });
        } else {
            parkedSalesListDiv.innerHTML = '<p>No parked sales.</p>';
        }
    } catch (error) {
        console.error("Error loading parked sales:", error);
        parkedSalesListDiv.innerHTML = '<p>Error loading parked sales.</p>';
        showToast("Could not load parked sales.", "error");
    }
    // updateCartDisplay might be needed if loading a sale affects cart, but loadSaleIntoCart should handle it.
}

export async function searchAllSales() {
    if (!allSalesSearchResultsDiv || !searchSaleIdInput || !searchSaleCustomerInput || !searchSaleStatusSelect) {
        console.warn("Search sales UI elements not found, aborting searchAllSales.");
        return;
    }
    allSalesSearchResultsDiv.innerHTML = '<p>Searching sales...</p>';

    const saleId = searchSaleIdInput.value.trim();
    const customerQuery = searchSaleCustomerInput.value.trim();
    const status = searchSaleStatusSelect.value;

    const queryParams = {};
    if (saleId) queryParams.sale_id = saleId;
    if (customerQuery) queryParams.customer_query = customerQuery;
    if (status) queryParams.status = status;

    try {
        const sales = await apiCall('/sales/', 'GET', null, queryParams);
        allSalesSearchResultsDiv.innerHTML = ''; 
        if (sales && sales.length > 0) {
            sales.forEach(sale => {
                const saleDiv = document.createElement('div');
                saleDiv.className = 'sale-search-result-item';
                let customerName = 'N/A';
                if (sale.customer) {
                    customerName = (sale.customer.name || '') + ' (' + (sale.customer.phone || 'No phone') + ')';
                }

                saleDiv.innerHTML = 
                    '<strong>Sale ID: ' + sale.id + '</strong> (Status: ' + sale.status + ')<br>' +
                    'Customer: ' + customerName + '<br>' +
                    'Date: ' + new Date(sale.created_at).toLocaleString() + '<br>' +
                    'Total: $' + sale.sale_total.toFixed(2) + ' | Paid: $' + sale.amount_paid.toFixed(2) + ' | Due: $' + sale.amount_due.toFixed(2) +
                    '<br>' +
                    'Items: ' + sale.sale_items.length + ' ' +
                    '<button class="view-sale-details-btn btn btn-info" data-sale-id="' + sale.id + '">View/Load</button>' +
                    '<button class="print-email-sale-btn btn btn-success" data-sale-id="' + sale.id + '">Print / Email</button>';
                
                const viewButton = saleDiv.querySelector('.view-sale-details-btn');
                if (viewButton) {
                    viewButton.addEventListener('click', () => {
                        loadSaleIntoCart(sale.id);
                        showToast('Sale ' + sale.id + ' loaded into cart.', 'success');
                    });
                }
                const printEmailButton = saleDiv.querySelector('.print-email-sale-btn');
                if (printEmailButton) {
                    printEmailButton.addEventListener('click', () => {
                        openPrintOptionsModal(sale.id, sale.status); 
                    });
                }
                allSalesSearchResultsDiv.appendChild(saleDiv);
            });
        } else if (sales) {
            allSalesSearchResultsDiv.innerHTML = '<p>No sales found matching your criteria.</p>';
        } else {
            allSalesSearchResultsDiv.innerHTML = '<p>Error searching sales. Please try again.</p>';
            // showToast already handled by apiCall in case of error
        }
    } catch (error) {
        console.error("Error during searchAllSales API call:", error);
        allSalesSearchResultsDiv.innerHTML = '<p>An error occurred while searching sales.</p>';
        // showToast handled by apiCall
    }
} 