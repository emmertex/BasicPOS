import { apiCall } from './apiService.js';
import { showToast } from './toastService.js';
import { state } from './uiState.js';
import { shrinkLeftPanel, expandParkedSales } from './panelUtils.js'; // Assuming these are needed and exist

// DOM Elements relevant to customer functions (will be initialized in initCustomerService)
let addCustomerModal;
let newCustomerNameInput;
let newCustomerPhoneInput;
let newCustomerEmailInput;
let newCustomerAddressInput;
let newCustomerCompanyInput;
let customerMgmtListDiv;
let customerDetailsCartDiv; 

let editCustomerModal;
let editCustomerIdInput;
let editCustomerNameInput;
let editCustomerPhoneInput;
let editCustomerEmailInput;
let editCustomerAddressInput;
let editCustomerCompanyInput;

let submitNewCustomerButton, submitNewCustomerAndAddToSaleButton, closeAddCustomerModalButton;
let submitUpdateCustomerButton, closeEditCustomerModalButton;

let customerMgmtSearchInput, customerMgmtAddNewButton;

// Callbacks from app.js
let updateCartDisplayFn = () => console.warn('updateCartDisplayFn not implemented in customerService');
let createNewSaleFn = async () => { console.warn('createNewSaleFn not implemented in customerService'); return null; };
let updateCartCustomerDisplayFn = () => console.warn('updateCartCustomerDisplayFn not implemented in customerService');

export function initCustomerService(appUpdateCartDisplay, appCreateNewSale, appUpdateCartCustomerDisplay) {
    // Initialize callbacks
    updateCartDisplayFn = appUpdateCartDisplay;
    createNewSaleFn = appCreateNewSale;
    updateCartCustomerDisplayFn = appUpdateCartCustomerDisplay;

    // Initialize DOM elements
    addCustomerModal = document.getElementById('customerModal');
    newCustomerNameInput = document.getElementById('new-customer-name');
    newCustomerPhoneInput = document.getElementById('new-customer-phone');
    newCustomerEmailInput = document.getElementById('new-customer-email');
    newCustomerAddressInput = document.getElementById('new-customer-address');
    newCustomerCompanyInput = document.getElementById('new-customer-company');
    customerMgmtListDiv = document.getElementById('customer-mgmt-list');
    customerDetailsCartDiv = document.getElementById('customer-details-cart');

    editCustomerModal = document.getElementById('edit-customer-modal');
    editCustomerIdInput = document.getElementById('edit-customer-id');
    editCustomerNameInput = document.getElementById('edit-customer-name');
    editCustomerPhoneInput = document.getElementById('edit-customer-phone');
    editCustomerEmailInput = document.getElementById('edit-customer-email');
    editCustomerAddressInput = document.getElementById('edit-customer-address');
    editCustomerCompanyInput = document.getElementById('edit-customer-company');

    submitNewCustomerButton = document.getElementById('submit-new-customer-button');
    submitNewCustomerAndAddToSaleButton = document.getElementById('submit-new-customer-and-add-to-sale-button');
    closeAddCustomerModalButton = document.getElementById('close-add-customer-modal');

    submitUpdateCustomerButton = document.getElementById('submit-update-customer-button');
    closeEditCustomerModalButton = document.getElementById('close-edit-customer-modal');

    customerMgmtSearchInput = document.getElementById('customer-mgmt-search-input');
    customerMgmtAddNewButton = document.getElementById('customer-mgmt-add-new-button');

    // Event listener for the save button in the edit customer modal
    if (submitUpdateCustomerButton) {
        submitUpdateCustomerButton.addEventListener('click', handleUpdateCustomer);
    } else {
        console.error("submit-update-customer-button not found during init!");
    }

    // Event listener for the close button of the edit customer modal
    if (closeEditCustomerModalButton) {
        closeEditCustomerModalButton.addEventListener('click', closeEditCustomerModal);
    } else {
        console.error("close-edit-customer-modal button not found during init!");
    }

    // Event listener for the close button of the add customer modal
    // (This might already be in app.js, but good to ensure it's handled if it's purely customer modal related)
    if (closeAddCustomerModalButton) {
        closeAddCustomerModalButton.addEventListener('click', closeAddCustomerModal);
    } else {
        console.warn("close-add-customer-modal button not found during customerService init (might be in app.js).");
    }

    // Event listener for the "Add New Customer" button in the customer management section
    if (customerMgmtAddNewButton) {
        customerMgmtAddNewButton.addEventListener('click', openAddCustomerModal);
    } else {
        console.error("customer-mgmt-add-new-button not found during init!");
    }
    
    // Event listener for the search input in customer management section
    if (customerMgmtSearchInput) {
        customerMgmtSearchInput.addEventListener('input', (event) => loadAndDisplayCustomers(event.target.value));
    } else {
        console.error("customer-mgmt-search-input not found during init!");
    }

    // Event Listeners for Add Customer Modal
    if (submitNewCustomerButton) {
        submitNewCustomerButton.addEventListener('click', () => handleSaveNewCustomer(false));
    } else { console.error("submit-new-customer-button not found"); }
    if (submitNewCustomerAndAddToSaleButton) {
        submitNewCustomerAndAddToSaleButton.addEventListener('click', () => handleSaveNewCustomer(true));
    } else { console.error("submit-new-customer-and-add-to-sale-button not found"); }
}

export function openAddCustomerModal() {
    if (!addCustomerModal || !newCustomerNameInput || !newCustomerPhoneInput || !newCustomerEmailInput || !newCustomerAddressInput || !newCustomerCompanyInput) {
        console.error("openAddCustomerModal: One or more add customer modal elements not found/initialized!");
        showToast("Error: Add customer dialog is missing or not ready.", "error");
        return;
    }
    newCustomerNameInput.value = '';
    newCustomerPhoneInput.value = '';
    newCustomerEmailInput.value = '';
    newCustomerAddressInput.value = '';
    newCustomerCompanyInput.value = '';
    addCustomerModal.style.display = 'block';
}

export async function handleSaveNewCustomer(addToSaleAfterSave = false) {
    const name = newCustomerNameInput.value.trim();
    const phone = newCustomerPhoneInput.value.trim();
    const email = newCustomerEmailInput.value.trim();
    const address = newCustomerAddressInput.value.trim();
    const company_name = newCustomerCompanyInput.value.trim();

    if (!name) {
        showToast('Customer name is required.', 'warning');
        return null;
    }

    const customerData = {
        name,
        phone: phone || null,
        email,
        address,
        company_name
    };

    try {
        showToast('Saving customer...', 'info');
        const savedCustomer = await apiCall('/customers/', 'POST', customerData);

        if (savedCustomer && savedCustomer.id) {
            showToast('Customer saved successfully!', 'success');
            if (addCustomerModal) addCustomerModal.style.display = 'none';
            // Clear form inputs (already done by openAddCustomerModal usually, but good practice here too)
            newCustomerNameInput.value = '';
            newCustomerPhoneInput.value = '';
            newCustomerEmailInput.value = '';
            newCustomerAddressInput.value = '';
            newCustomerCompanyInput.value = '';
            
            loadAndDisplayCustomers(); // Refresh customer list in management section

            if (addToSaleAfterSave) {
                state.currentCustomer = savedCustomer;
                updateCartCustomerDisplayFn(state.currentCustomer); 

                if (!state.currentSale) {
                    // Call createNewSaleFn which should be initialized from app.js
                    state.currentSale = await createNewSaleFn('Open', state.currentCustomer.id);
                    if (state.currentSale) {
                        showToast('New sale started with customer.', 'info');
                         updateCartDisplayFn(); 
                    } else {
                        showToast('Failed to start new sale with customer.', 'error');
                    }
                } else {
                    const updatedSale = await apiCall(`/sales/${state.currentSale.id}`, 'PUT', { customer_id: state.currentCustomer.id });
                    if (updatedSale) {
                        state.currentSale = updatedSale;
                        showToast('Customer added to current sale.', 'success');
                        updateCartDisplayFn();
                    } else {
                        showToast('Failed to add customer to existing sale.', 'error');
                    }
                }
                shrinkLeftPanel(); 
                expandParkedSales();
            }
            return savedCustomer;
        } else {
            showToast('Failed to save customer. Invalid response from server.', 'error');
            return null;
        }
    } catch (error) {
        console.error('Error saving new customer:', error);
        showToast('Error saving customer. Check console for details.', 'error');
        return null;
    }
}

export async function loadAndDisplayCustomers(searchTerm = '') {
    if (!customerMgmtListDiv) {
        console.warn("loadAndDisplayCustomers: customerMgmtListDiv not initialized.");
        return;
    }
    customerMgmtListDiv.innerHTML = '<p>Loading customers...</p>';
    const customersData = await apiCall('/customers/'); // Renamed to avoid conflict
    customerMgmtListDiv.innerHTML = '';
    if (customersData && customersData.length > 0) {
        const searchTermLower = typeof searchTerm === 'string' ? searchTerm.toLowerCase() : '';
        
        // If searchTerm is an event object (from input event listener), get value from event.target
        let currentSearchTerm = searchTermLower;
        if (typeof searchTerm === 'object' && searchTerm.target && typeof searchTerm.target.value === 'string') {
            currentSearchTerm = searchTerm.target.value.toLowerCase();
        }

        // Sort customers alphabetically by name
        customersData.sort((a, b) => a.name.localeCompare(b.name));

        customersData
            .filter(customer => {
                if (!currentSearchTerm) return true;
                return customer.name.toLowerCase().includes(currentSearchTerm) ||
                       (customer.phone && customer.phone.toLowerCase().includes(currentSearchTerm)) ||
                       (customer.email && customer.email.toLowerCase().includes(currentSearchTerm)) ||
                       (customer.company_name && customer.company_name.toLowerCase().includes(currentSearchTerm));
            })
            .forEach(customer => {
                const custDiv = document.createElement('div');
                custDiv.className = 'customer-list-item';
                custDiv.innerHTML = `
                    <div>
                        <strong>${customer.name}</strong> (${customer.phone || 'No phone'})<br>
                        ${customer.email || 'No email'}<br>
                        Address: ${customer.address || 'N/A'}<br>
                        Company: ${customer.company_name || 'N/A'}
                    </div>
                    <div style="margin-top: 5px; display: flex; gap: 5px;">
                        <button class="edit-customer-btn btn btn-warning btn-sm" data-customer-id="${customer.id}">Edit</button>
                        <button class="select-customer-for-sale-btn btn btn-primary btn-sm" data-customer-id="${customer.id}">Select</button>
                    </div>
                `;
                custDiv.querySelector('.edit-customer-btn').addEventListener('click', () => openEditCustomerModal(customer.id));
                custDiv.querySelector('.select-customer-for-sale-btn').addEventListener('click', async () => {
                    state.currentCustomer = customer;
                    // customerDetailsCartDiv is now managed by updateCartCustomerDisplayFn from cart.js via app.js
                    updateCartCustomerDisplayFn(state.currentCustomer);

                    if (state.currentSale && state.currentSale.id) {
                        try {
                            const saleAfterAssociation = await apiCall(`/sales/${state.currentSale.id}`, 'PUT', { customer_id: customer.id });
                            if (saleAfterAssociation && saleAfterAssociation.id) {
                                state.currentSale = saleAfterAssociation;
                                // state.currentCustomer might be updated server-side if sale.customer is eager loaded
                                if (state.currentSale.customer) { 
                                    state.currentCustomer = state.currentSale.customer;
                                }
                                updateCartCustomerDisplayFn(state.currentCustomer);
                                updateCartDisplayFn(); 
                            } else {
                                showToast(`Failed to associate ${customer.name} with current sale.`, 'error');
                            }
                        } catch (error) {
                            console.error('Error associating customer from list:', error);
                            showToast(`Error associating customer: ${error.message || 'Unknown error'}`, 'error');
                        }
                    } else {
                        showToast(`Customer ${customer.name} selected. Will be used for next new sale.`, 'info');
                        updateCartCustomerDisplayFn(state.currentCustomer);
                    }
                    shrinkLeftPanel();
                    expandParkedSales();
                });
                customerMgmtListDiv.appendChild(custDiv);
            });
    } else {
        customerMgmtListDiv.innerHTML = '<p>No customers found. Click "Add New Customer" to add one.</p>';
    }
}

export async function openEditCustomerModal(customerId) {
    if (!editCustomerModal || !editCustomerIdInput || !editCustomerNameInput || !editCustomerPhoneInput || !editCustomerEmailInput || !editCustomerAddressInput || !editCustomerCompanyInput ) {
        console.error("openEditCustomerModal: One or more edit customer modal elements not found/initialized!");
        showToast("Error: Edit customer dialog is missing or not ready.", "error");
        return;
    }
    try {
        const customer = await apiCall(`/customers/${customerId}`);
        if (customer && customer.id) {
            editCustomerIdInput.value = customer.id;
            editCustomerNameInput.value = customer.name;
            editCustomerPhoneInput.value = customer.phone || '';
            editCustomerEmailInput.value = customer.email || '';
            editCustomerAddressInput.value = customer.address || '';
            editCustomerCompanyInput.value = customer.company_name || '';
            if (editCustomerModal) editCustomerModal.style.display = 'block';
        } else {
            showToast(`Could not fetch details for customer ID ${customerId}.`, 'error');
        }
    } catch (error) {
        console.error(`Error fetching customer ${customerId} for edit:`, error);
        showToast(`Error fetching customer: ${error.message || 'Unknown error'}`, 'error');
    }
}

export function closeEditCustomerModal() {
    if (editCustomerModal) {
        editCustomerModal.style.display = 'none';
    }
}

export async function handleUpdateCustomer() {
    if (!editCustomerIdInput || !editCustomerNameInput || !editCustomerPhoneInput || !editCustomerEmailInput || !editCustomerAddressInput || !editCustomerCompanyInput) {
        console.error("handleUpdateCustomer: One or more edit customer modal elements not found/initialized!");
        showToast("Error: Edit customer dialog is missing or not ready.", "error");
        return;
    }
    const id = editCustomerIdInput.value;
    const name = editCustomerNameInput.value.trim();
    const phone = editCustomerPhoneInput.value.trim();
    const email = editCustomerEmailInput.value.trim();
    const address = editCustomerAddressInput.value.trim();
    const company = editCustomerCompanyInput.value.trim();

    if (!name) {
        showToast('Customer name is required.', 'warning');
        return;
    }
    const customerData = { name, phone: phone || null, email, address, company_name: company };
    const updatedCustomer = await apiCall(`/customers/${id}`, 'PUT', customerData);

    if (updatedCustomer && updatedCustomer.id) {
        showToast('Customer updated successfully!', 'success');
        closeEditCustomerModal();
        loadAndDisplayCustomers();
        if (state.currentCustomer && state.currentCustomer.id === parseInt(id)) {
            state.currentCustomer = updatedCustomer;
            updateCartCustomerDisplayFn(state.currentCustomer);
        }
    } else {
        const errorMessage = updatedCustomer && updatedCustomer.error ? updatedCustomer.error : 'Invalid response from server.';
        showToast(`Failed to update customer. ${errorMessage}`, 'error');
    }
}

export function closeAddCustomerModal() {
    if (addCustomerModal) {
        addCustomerModal.style.display = 'none';
    }
}