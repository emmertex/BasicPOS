// Basic POS System - app.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("POS App Loaded");

    // Global state (simplified)
    let currentSale = null; // Will hold sale ID and items
    let currentCustomer = null;

    // UI Elements
    const itemSearchInput = document.getElementById('item-search-input');
    const itemSearchButton = document.getElementById('item-search-button');
    const itemSearchResultsDiv = document.getElementById('item-search-results');
    
    const cartItemsDiv = document.getElementById('cart-items');
    const cartTotalSpan = document.getElementById('cart-total');

    const customerDetailsCartDiv = document.getElementById('customer-details-cart');

    const parkSaleButton = document.getElementById('park-sale-button');
    const finalizeSaleButton = document.getElementById('finalize-sale-button');
    const newQuoteButton = document.getElementById('new-quote-button');
    const parkedSalesListDiv = document.getElementById('parked-sales-list');

    // Payment Modal UI Elements
    const paymentModal = document.getElementById('payment-modal');
    const closePaymentModalButton = document.getElementById('close-payment-modal');
    const paymentModalSaleIdSpan = document.getElementById('payment-modal-sale-id');
    const paymentModalAmountDueSpan = document.getElementById('payment-modal-amount-due');
    const paymentTypeSelect = document.getElementById('payment-type-select');
    const paymentAmountInput = document.getElementById('payment-amount-input');
    const submitPaymentButton = document.getElementById('submit-payment-button');
    const invoiceRemainingButton = document.getElementById('invoice-remaining-button');

    // Add Customer Modal UI Elements
    const addCustomerModal = document.getElementById('add-customer-modal');
    const closeAddCustomerModalButton = document.getElementById('close-add-customer-modal');
    const newCustomerNameInput = document.getElementById('new-customer-name');
    const newCustomerPhoneInput = document.getElementById('new-customer-phone');
    const newCustomerEmailInput = document.getElementById('new-customer-email');
    const newCustomerAddressInput = document.getElementById('new-customer-address');
    const newCustomerCompanyInput = document.getElementById('new-customer-company');
    const submitNewCustomerButton = document.getElementById('submit-new-customer-button');

    // Customer Management Section UI Elements
    const customerMgmtSection = document.getElementById('customer-management-section'); // Assuming this section might be shown/hidden
    const customerMgmtSearchInput = document.getElementById('customer-mgmt-search-input');
    const customerMgmtAddNewButton = document.getElementById('customer-mgmt-add-new-button');
    const customerMgmtListDiv = document.getElementById('customer-mgmt-list');

    // Edit Customer Modal UI Elements
    const editCustomerModal = document.getElementById('edit-customer-modal');
    const closeEditCustomerModalButton = document.getElementById('close-edit-customer-modal');
    const editCustomerIdInput = document.getElementById('edit-customer-id');
    const editCustomerNameInput = document.getElementById('edit-customer-name');
    const editCustomerPhoneInput = document.getElementById('edit-customer-phone');
    const editCustomerEmailInput = document.getElementById('edit-customer-email');
    const editCustomerAddressInput = document.getElementById('edit-customer-address');
    const editCustomerCompanyInput = document.getElementById('edit-customer-company');
    const submitUpdateCustomerButton = document.getElementById('submit-update-customer-button');

    // All Sales Search UI Elements
    const searchSaleIdInput = document.getElementById('search-sale-id');
    const searchSaleCustomerInput = document.getElementById('search-sale-customer');
    const searchSaleStatusSelect = document.getElementById('search-sale-status');
    const searchSalesButton = document.getElementById('search-sales-button');
    const allSalesSearchResultsDiv = document.getElementById('all-sales-search-results');

    // Variant Selection Modal UI Elements
    const variantSelectionModal = document.getElementById('variant-selection-modal');
    const closeVariantSelectionModalButton = document.getElementById('close-variant-selection-modal');
    const variantModalTitle = document.getElementById('variant-modal-title');
    const variantListContainer = document.getElementById('variant-list-container');

    // Add/Edit Item Modal UI Elements
    const addEditItemModal = document.getElementById('add-edit-item-modal');
    const closeAddEditItemModalButton = document.getElementById('close-add-edit-item-modal');
    const itemModalTitle = document.getElementById('item-modal-title');
    const editItemIdInput = document.getElementById('edit-item-id');
    const itemTitleInput = document.getElementById('item-title');
    const itemSkuInput = document.getElementById('item-sku');
    const itemPriceInput = document.getElementById('item-price');
    const itemStockQuantityInput = document.getElementById('item-stock-quantity');
    const itemDescriptionInput = document.getElementById('item-description');
    const itemParentIdInput = document.getElementById('item-parent-id');
    const itemIsStockTrackedCheckbox = document.getElementById('item-is-stock-tracked');
    const itemShowOnWebsiteCheckbox = document.getElementById('item-show-on-website');
    const itemIsActiveCheckbox = document.getElementById('item-is-active');
    const submitItemButton = document.getElementById('submit-item-button');
    const manageVariantsButton = document.getElementById('manage-variants-button');
    
    const itemImageDropZone = document.getElementById('item-image-drop-zone');
    const itemImagesUploadInput = document.getElementById('item-images-upload');
    const itemImagesListDiv = document.getElementById('item-images-list'); // For displaying selected file names

    // Quick Add Dashboard UI Elements
    const quickAddGridContainer = document.getElementById('quick-add-grid-container');
    const quickAddCurrentPageSpan = document.getElementById('quick-add-current-page');
    const quickAddPageInfoDiv = document.getElementById('quick-add-page-info');
    
    // Edit Mode controls for Quick Add
    const quickAddEditModeBtn = document.getElementById('quick-add-edit-mode-btn');
    const quickAddControlsDiv = document.getElementById('quick-add-controls');
    const quickAddEditActions = document.getElementById('quick-add-edit-actions');
    const quickAddNewItemBtn = document.getElementById('quick-add-new-item-btn');
    const quickAddNewPageLinkBtn = document.getElementById('quick-add-new-page-link-btn');

    // Modals for Quick Add editing
    const quickAddNewItemModal = document.getElementById('quick-add-new-item-modal');
    const closeQuickAddNewItemModalBtn = document.getElementById('close-quick-add-new-item-modal');
    const qaiItemSearchInput = document.getElementById('qai-item-search-input');
    const qaiItemSearchButton = document.getElementById('qai-item-search-button');
    const qaiItemSearchResultsDiv = document.getElementById('qai-item-search-results');

    const quickAddNewPageLinkModal = document.getElementById('quick-add-new-page-link-modal');
    const closeQuickAddNewPageLinkModalBtn = document.getElementById('close-quick-add-new-page-link-modal');
    const qaiPageLinkLabelInput = document.getElementById('qai-page-link-label');
    const qaiPageLinkTargetInput = document.getElementById('qai-page-link-target');
    const qaiPageLinkColorInput = document.getElementById('qai-page-link-color');
    const qaiSubmitNewPageLinkButton = document.getElementById('qai-submit-new-page-link-button');

    let currentQuickAddPage = 1;
    let isQuickAddEditMode = false;
    let draggedQAI = null; // To store the element being dragged

    // Button to trigger Add Item Modal (to be placed in HTML, e.g., item search section)
    const openAddItemModalButton = document.getElementById('open-add-item-modal-button'); // Assuming an ID for this button

    // --- API Base URL ---
    const API_BASE_URL = 'http://127.0.0.1:5000/api';

    // --- Toast Notification System ---
    const toastContainer = document.getElementById('toast-container');

    function showToast(message, type = 'info', duration = 3000) {
        if (!toastContainer) {
            console.error('Toast container not found!');
            // Fallback to alert if toast system isn't available
            alert(`${type.toUpperCase()}: ${message}`);
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        // toast.textContent = message; // Using innerHTML to allow for a close button easily

        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        toast.appendChild(messageSpan);

        // Optional: Add a close button to the toast
        const closeButton = document.createElement('button');
        closeButton.className = 'toast-close-button';
        closeButton.innerHTML = '&times;'; // 'x' character
        closeButton.onclick = () => {
            toast.classList.remove('show');
            // Optional: Wait for animation to finish before removing
            setTimeout(() => {
                if (toast.parentNode) { // Check if it hasn't been removed by duration timeout
                    toast.parentNode.removeChild(toast);
                }
            }, 500); // Match CSS transition time
        };
        toast.appendChild(closeButton);

        toastContainer.appendChild(toast);

        // Trigger the slide-in animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 10); // Small delay to ensure CSS transition triggers

        // Auto-dismiss after duration
        setTimeout(() => {
            toast.classList.remove('show');
            // Wait for animation to finish before removing from DOM
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 500); // Match CSS transition time
        }, duration);
    }

    // --- Helper Functions ---
    async function apiCall(endpoint, method = 'GET', body = null, queryParams = null) {
        let url = `${API_BASE_URL}${endpoint}`;
        if (queryParams && Object.keys(queryParams).length > 0) {
            const params = new URLSearchParams();
            for (const key in queryParams) {
                if (queryParams[key] !== null && queryParams[key] !== undefined && queryParams[key] !== '') {
                    params.append(key, queryParams[key]);
                }
            }
            if (params.toString()) {
                 url += `?${params.toString()}`;
            }
        }

        const options = {
            method,
            headers: {
                // Content-Type will be set conditionally below
            }
        };

        if (body) {
            if (body instanceof FormData) {
                // For FormData, don't set Content-Type header;
                // the browser will set it with the correct boundary.
                options.body = body;
            } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(body);
            }
        } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
             // If it's a POST/PUT/PATCH but no body, send empty JSON object by default 
             // if server expects Content-Type application/json. 
             // Some servers might require this. For others, this line can be removed.
             options.headers['Content-Type'] = 'application/json';
             options.body = JSON.stringify({}); 
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: response.statusText }));
                console.error('API Error:', errorData);
                showToast(`API Error: ${errorData.error || 'Unknown API error'}`, 'error');
                return null;
            }
            if (response.status === 204) { // No Content
                return true; 
            }
            return await response.json();
        } catch (error) {
            console.error('Fetch Error:', error);
            showToast(`Network Error: ${error.message}`, 'error');
            return null;
        }
    }

    // --- Initial Load Functions ---
    async function loadParkedSales() {
        parkedSalesListDiv.innerHTML = '<p>Loading parked sales...</p>';
        const sales = await apiCall('/sales/status/Open');
        console.log("Fetched parked sales:", sales); // Log fetched sales
        parkedSalesListDiv.innerHTML = ''; // Clear loading
        if (sales && sales.length > 0) {
            sales.forEach(sale => {
                const saleDiv = document.createElement('div');
                saleDiv.className = 'parked-sale-item'; // Add class for styling
                saleDiv.innerHTML = `ID: ${sale.id} - Items: ${sale.sale_items.length} - Total: ${sale.sale_total.toFixed(2)}`;
                saleDiv.dataset.saleId = sale.id;
                saleDiv.addEventListener('click', () => loadSaleIntoCart(sale.id));
                parkedSalesListDiv.appendChild(saleDiv);
            });
        } else {
            parkedSalesListDiv.innerHTML = '<p>No parked sales found.</p>';
        }
    }
    
    // --- Core Functionality ---

    // Item Search
    async function searchItems() {
        const query = itemSearchInput.value.trim();
        console.log('searchItems called with query:', query); // For debugging

        itemSearchResultsDiv.innerHTML = '<p>Searching...</p>';
        
        const queryParams = {};
        // If the query doesn't have spaces, it might be an SKU.
        // The backend will prioritize exact SKU match.
        if (query && !query.includes(' ')) {
            queryParams.sku = query;
        }
        // Always send as title_query as well for broader matching if SKU isn't exact or if it has spaces.
        if (query) {
            queryParams.title_query = query;
        }

        const items = await apiCall('/items/', 'GET', null, queryParams);
        itemSearchResultsDiv.innerHTML = '';
        if (items) {
            if (items.length > 0) {
                items.forEach(item => {
                    const itemDiv = document.createElement('div');
                    // itemDiv.className = 'item-search-result-item'; // Optional: if you want more specific styling

                    // Add primary image if available
                    if (item.photos && item.photos.length > 0) {
                        const primaryPhoto = item.photos.find(p => p.is_primary);
                        if (primaryPhoto && primaryPhoto.small_url) {
                            const img = document.createElement('img');
                            img.src = primaryPhoto.small_url;
                            img.alt = item.title;
                            img.className = 'item-search-list-image'; // For styling
                            itemDiv.appendChild(img); // Prepend or append as desired
                        }
                    }

                    let displayText = `${item.title} (SKU: ${item.sku}) - $${item.price ? item.price.toFixed(2) : 'N/A'}`;
                    if (item.parent_id === -2) {
                        displayText = `<strong>${item.title} (SKU: ${item.sku}) [Has Variants]</strong>`; // Bold and no price
                    } else {
                        displayText = `${item.title} (SKU: ${item.sku}) - $${item.price ? item.price.toFixed(2) : 'N/A'}`;
                    }
                    
                    const textContainer = document.createElement('div');
                    textContainer.className = 'item-text-content';
                    textContainer.innerHTML = displayText;

                    itemDiv.appendChild(textContainer);
                    
                    itemDiv.dataset.itemId = item.id;
                    itemDiv.dataset.itemPrice = item.price;
                    itemDiv.dataset.parentId = item.parent_id; // Store parent_id

                    // Add an Edit button
                    const editButton = document.createElement('button');
                    editButton.textContent = 'Edit';
                    editButton.className = 'edit-item-btn'; // For styling
                    editButton.style.marginLeft = '10px';
                    editButton.style.backgroundColor = '#f0ad4e'; // Orange color
                    editButton.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent triggering the itemDiv click listener
                        openEditItemForm(item.id);
                    });

                    // Click on itemDiv itself (for adding to cart or opening variant modal)
                    itemDiv.addEventListener('click', () => {
                        if (item.parent_id === -2) {
                            openVariantSelectionModal(item);
                        } else {
                            addItemToCart(item.id, item.price);
                        }
                    });
                    itemDiv.appendChild(editButton); // Append edit button to itemDiv
                    itemSearchResultsDiv.appendChild(itemDiv);
                });
            } else {
                itemSearchResultsDiv.innerHTML = '<p>No items found matching your search.</p>';
            }
        } else {
            itemSearchResultsDiv.innerHTML = '<p>Error fetching items.</p>';
        }
    }

    // Cart Management
    async function createNewSale(status = 'Open', customerId = null) {
        const saleData = { status };
        if (customerId) {
            saleData.customer_id = customerId;
        }
        const newSale = await apiCall('/sales/', 'POST', saleData);
        if (newSale) {
            currentSale = newSale;
            updateCartDisplay();
            loadParkedSales(); // Refresh parked sales list
        }
        return newSale;
    }

    async function addItemToCart(itemId, price) {
        // If currentSale exists but is in a non-Open/Quote state, effectively start a new one.
        if (currentSale && currentSale.id && 
            (currentSale.status === 'Invoice' || currentSale.status === 'Paid' || currentSale.status === 'Void')) {
            console.log(`Current sale ${currentSale.id} is ${currentSale.status}. Forcing new sale for item add.`);
            showToast(`Current sale is ${currentSale.status}. Starting a new sale.`, 'info');
            currentSale = null; // This will trigger createNewSale below
            // currentCustomer = null; // Reset customer if the sale context is being forcibly changed.
            // customerDetailsCartDiv.textContent = ''; // Clear customer display
            // updateCartDisplay(); // Update display to reflect the reset state before new sale creation
        }

        if (!currentSale || !currentSale.id) {
            // alert('No active sale. Creating a new one.');
            const sale = await createNewSale('Open', currentCustomer ? currentCustomer.id : null);
            if (!sale) return; // Failed to create new sale
        }

        const saleItemData = {
            item_id: itemId,
            quantity: 1, // Default quantity
            // sale_price: price // Or let backend decide based on item.price
        };
        const updatedSale = await apiCall(`/sales/${currentSale.id}/items`, 'POST', saleItemData);
        if (updatedSale) {
            currentSale = updatedSale;
            updateCartDisplay();
        } else {
            // This branch could be hit if apiCall returned null (e.g. backend error like "already paid")
            // currentSale would not have been updated with a successful response.
            // The error toast from apiCall should have already informed the user.
            // We might want to re-evaluate currentSale state here too, or ensure updateCartDisplay reflects its true state.
            console.warn("addItemToCart: updatedSale was null, currentSale might be stale.");
            // Optionally, refresh currentSale from backend if add failed, to ensure UI consistency
            // loadSaleIntoCart(currentSale.id); 
        }
    }
    
    async function loadSaleIntoCart(saleId) {
        const sale = await apiCall(`/sales/${saleId}`);
        if (sale) {
            currentSale = sale;
            if (sale.customer) {
                currentCustomer = sale.customer;
                customerDetailsCartDiv.textContent = `Customer: ${currentCustomer.name} (${currentCustomer.phone})`;
            } else {
                currentCustomer = null;
                customerDetailsCartDiv.textContent = '';
            }
            updateCartDisplay();
            itemSearchResultsDiv.innerHTML = ''; // Clear item search
        }
    }

    function updateCartDisplay() {
        cartItemsDiv.innerHTML = '';
        const saleStatusDisplay = document.getElementById('cart-sale-status');
        let canModifyCart = false;
        let canFinalize = false;

        if (currentSale) {
            if (saleStatusDisplay) saleStatusDisplay.textContent = `Status: ${currentSale.status}`;
            canModifyCart = currentSale.status === 'Open' || currentSale.status === 'Quote';
            // Can finalize if Open/Quote/Invoice, has items, and has a customer
            canFinalize = (currentSale.status === 'Open' || currentSale.status === 'Quote' || currentSale.status === 'Invoice') && 
                           currentSale.sale_items && currentSale.sale_items.length > 0 && currentSale.customer_id;

            if (currentSale.sale_items) {
                currentSale.sale_items.forEach(item => {
                    const cartItemDiv = document.createElement('div');
                    cartItemDiv.className = 'cart-item-entry'; // Added class for easier styling if needed
                    let itemHTML = 
                        `<span>${item.item.title} (Qty: ${item.quantity}) - $${(item.sale_price * item.quantity).toFixed(2)}</span>`;
                    
                    if (canModifyCart) {
                        itemHTML += 
                         `<button class="remove-item-btn" data-sale-item-id="${item.id}">Remove</button>
                         <input type="number" class="update-qty-input" value="${item.quantity}" min="1" data-sale-item-id="${item.id}" style="width: 50px; margin-left: 5px;">`;
                    } else {
                        // Optionally show quantity as text if not modifiable
                        // itemHTML += `<span> Qty: ${item.quantity}</span>`;
                    }
                    cartItemDiv.innerHTML = itemHTML;
                    cartItemsDiv.appendChild(cartItemDiv);
                });
            }
            cartTotalSpan.textContent = currentSale.sale_total ? currentSale.sale_total.toFixed(2) : '0.00';
        } else {
            if (saleStatusDisplay) saleStatusDisplay.textContent = 'No Active Sale';
            cartTotalSpan.textContent = '0.00';
        }

        // Update button states
        if (parkSaleButton) {
            parkSaleButton.disabled = !canModifyCart; // Can only park Open/Quote sales
        }
        if (finalizeSaleButton) {
            finalizeSaleButton.disabled = !canFinalize;
        }
        if (newQuoteButton) {
            // New Quote button should perhaps always be enabled, or disabled if current sale is already a quote and pristine
            // For now, let's assume it's generally available to start fresh.
            newQuoteButton.disabled = false; 
        }
    }

    // Park Sale
    async function parkCurrentSale() {
        if (currentSale && currentSale.status === 'Open') {
            showToast(`Sale ${currentSale.id} is already Open (Parked).`, 'info');
            // Or, if you want to explicitly save/update an open sale:
            // const updatedSale = await apiCall(`/sales/${currentSale.id}/status`, 'PUT', { status: 'Open' });
            // if (updatedSale) currentSale = updatedSale;
        } else if (currentSale) {
            showToast('Cannot park a sale that is not in Open status or already processed.', 'warning');
            return;
        }
        // If currentSale is null, it implies starting a new one and parking it immediately.
        // For now, assume parking means current cart is cleared and saved.
        if (currentSale) {
             console.log("Sale "+ currentSale.id + " parked.");
        }
        currentSale = null;
        currentCustomer = null;
        customerDetailsCartDiv.textContent = '';
        updateCartDisplay();
        loadParkedSales(); // Refresh list
        showToast("Cart cleared. Sale is parked if it was open.", 'info');
    }

    // Event Listeners
    if (itemSearchButton) {
        itemSearchButton.addEventListener('click', searchItems);
        itemSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchItems(); });
    }

    if (parkSaleButton) {
        parkSaleButton.addEventListener('click', parkCurrentSale);
    }

    if (newQuoteButton) {
        newQuoteButton.addEventListener('click', async () => {
            currentSale = null; // Clear current sale
            currentCustomer = null;
            customerDetailsCartDiv.textContent = '';
            const quote = await createNewSale('Quote', currentCustomer ? currentCustomer.id : null);
            if (quote) {
                showToast(`New Quote #${quote.id} started.`, 'success');
            }
            updateCartDisplay();
        });
    }

    // Delegated event listeners for dynamically added buttons (remove item, update quantity)
    cartItemsDiv.addEventListener('click', async (event) => {
        if (event.target.classList.contains('remove-item-btn')) {
            if (!currentSale || !currentSale.id) return;
            const saleItemId = event.target.dataset.saleItemId;
            const updatedSale = await apiCall(`/sales/${currentSale.id}/items/${saleItemId}`, 'DELETE');
            if (updatedSale) {
                currentSale = updatedSale;
                updateCartDisplay();
            }
        }
    });

    cartItemsDiv.addEventListener('change', async (event) => {
        if (event.target.classList.contains('update-qty-input')) {
            if (!currentSale || !currentSale.id) return;
            const saleItemId = event.target.dataset.saleItemId;
            const newQuantity = parseInt(event.target.value);
            if (isNaN(newQuantity) || newQuantity < 1) {
                showToast("Invalid quantity.", 'error');
                event.target.value = currentSale.sale_items.find(si => si.id == saleItemId).quantity; // Revert
                return;
            }
            const updatedSale = await apiCall(`/sales/${currentSale.id}/items/${saleItemId}`, 'PUT', { quantity: newQuantity });
            if (updatedSale) {
                currentSale = updatedSale;
                updateCartDisplay();
            }
        }
    });

    // --- Initial Page Load ---
    loadParkedSales();
    // createNewSale(); // Optionally start with a new empty sale

    // --- Customer Management (Cart specific) ---
    /* 
    async function searchCustomersAndAssociate() {
        const query = customerSearchInput.value.trim().toLowerCase();
        if (!query) {
            alert("Please enter a name or phone to search for a customer.");
            return;
        }
        // For now, fetch all and filter client-side. Consider backend search for large datasets.
        const customers = await apiCall('/customers/');
        if (customers) {
            const filteredCustomers = customers.filter(c => 
                c.name.toLowerCase().includes(query) || 
                (c.phone && c.phone.toLowerCase().includes(query))
            );
            
            customerDetailsCartDiv.innerHTML = ''; // Clear previous results/message
            if (filteredCustomers.length > 0) {
                filteredCustomers.forEach(customer => {
                    const custDiv = document.createElement('div');
                    custDiv.textContent = `${customer.name} - ${customer.phone}`;
                    custDiv.style.cursor = 'pointer';
                    custDiv.addEventListener('click', async () => {
                        currentCustomer = customer;
                        customerDetailsCartDiv.textContent = `Selected: ${customer.name} (${customer.phone})`;
                        if (currentSale && currentSale.id) {
                            const updatedSale = await apiCall(`/sales/${currentSale.id}`, 'PUT', { customer_id: customer.id });
                            if (updatedSale) {
                                currentSale = updatedSale; // Update sale with customer
                                console.log(`Associated customer ${customer.id} with sale ${currentSale.id}`);
                            }
                        } else {
                            console.log("No active sale to associate customer with yet. Customer selected for next sale.");
                        }
                    });
                    customerDetailsCartDiv.appendChild(custDiv);
                });
            } else {
                customerDetailsCartDiv.innerHTML = '<p>No customers found. <button id="open-add-customer-modal-from-cart">Add New?</button></p>';
                document.getElementById('open-add-customer-modal-from-cart')?.addEventListener('click', openAddCustomerModal);
            }
        }
    }

    // Event delegation for dynamically created buttons within customerDetailsCartDiv - REMOVED
    // customerDetailsCartDiv.addEventListener('click', async (event) => { ... });
    */

    function openAddCustomerModal() {
        // Clear previous input fields
        newCustomerNameInput.value = '';
        newCustomerPhoneInput.value = '';
        newCustomerEmailInput.value = '';
        newCustomerAddressInput.value = '';
        newCustomerCompanyInput.value = '';
        if (customerSearchInput.value.match(/^[\d\s-()]*$/)) { // If it looks like a phone number
             newCustomerPhoneInput.value = customerSearchInput.value;
        } else if (customerSearchInput.value) { // Otherwise assume it might be a name
             newCustomerNameInput.value = customerSearchInput.value;
        }
        addCustomerModal.style.display = 'block';
    }

    function closeAddCustomerModal() {
        addCustomerModal.style.display = 'none';
    }

    async function handleSaveNewCustomer() {
        const name = newCustomerNameInput.value.trim();
        const phone = newCustomerPhoneInput.value.trim();
        const email = newCustomerEmailInput.value.trim();
        const address = newCustomerAddressInput.value.trim();
        const company = newCustomerCompanyInput.value.trim();

        if (!name || !phone) {
            showToast('Name and Phone are required for customer.', 'error');
            return;
        }

        const newCustomerData = { name, phone, email, address, company_name: company };
        const savedCustomer = await apiCall('/customers/', 'POST', newCustomerData);

        if (savedCustomer) {
            showToast('Customer saved successfully!', 'success');
            closeAddCustomerModal();
            // If this was triggered from cart, associate with current sale
            // The check for 'open-add-customer-modal-from-cart' is no longer strictly needed here as the button is removed,
            // but keeping the logic for associating currentCustomer if it was set by some other means before opening modal.
            if (currentCustomer === savedCustomer) { // Or a more robust check if modal was opened with intent to associate
                 // customerDetailsCartDiv.textContent = `Selected: ${savedCustomer.name} (${savedCustomer.phone})`; // This will be set by main list selection now
                 if (currentSale && currentSale.id && currentCustomer && currentCustomer.id) { // Ensure currentCustomer is set
                     const updatedSale = await apiCall(`/sales/${currentSale.id}`, 'PUT', { customer_id: savedCustomer.id });
                     if (updatedSale) {
                         currentSale = updatedSale;
                     }
                 }
            }
            loadAndDisplayCustomers(); 
        }
    }

    // Event listeners for Add Customer Modal
    if (closeAddCustomerModalButton) {
        closeAddCustomerModalButton.addEventListener('click', closeAddCustomerModal);
    }
    if (submitNewCustomerButton) {
        submitNewCustomerButton.addEventListener('click', handleSaveNewCustomer);
    }
    // Close Add Customer modal if user clicks outside of it
    window.addEventListener('click', (event) => {
        if (event.target == addCustomerModal) { // Check for add customer modal specifically
            closeAddCustomerModal();
        }
    });

    // --- Finalize and Pay --- 
    async function handleFinalizeAndPay() {
        if (!currentSale || !currentSale.id) {
            showToast("No active sale to finalize.", 'warning');
            return;
        }

        if (!currentSale.customer_id) {
            showToast("Please associate a customer with the sale before finalizing.", 'warning');
            return;
        }

        let saleToProcess = currentSale;

        if (saleToProcess.status === 'Paid') {
            showToast(`Sale ${saleToProcess.id} is already Paid.`, 'info');
            return;
        }
        if (saleToProcess.status === 'Void') {
            showToast(`Sale ${saleToProcess.id} is Void. Cannot process payment.`, 'warning');
            return;
        }

        openPaymentModal(saleToProcess);
    }

    // --- Payment Modal Functions ---
    function openPaymentModal(sale) {
        paymentModalSaleIdSpan.textContent = sale.id;
        paymentModalAmountDueSpan.textContent = sale.amount_due.toFixed(2);
        paymentAmountInput.value = sale.amount_due.toFixed(2);
        paymentTypeSelect.value = 'Cash';
        paymentModal.style.display = 'block';

        // Conditionally show/hide the "Invoice & Keep Open" button
        if (sale.status === 'Open' || sale.status === 'Quote') {
            invoiceRemainingButton.style.display = 'inline-block';
        } else {
            invoiceRemainingButton.style.display = 'none';
        }
    }

    function closePaymentModal() {
        paymentModal.style.display = 'none';
    }

    async function handleInvoiceAndKeepOpen() {
        console.log("handleInvoiceAndKeepOpen called");
        if (!currentSale || !currentSale.id || (currentSale.status !== 'Open' && currentSale.status !== 'Quote')) {
            showToast("This action is only valid for 'Open' or 'Quote' sales.", 'warning');
            return;
        }

        const updatedSale = await apiCall(`/sales/${currentSale.id}/status`, 'PUT', { status: 'Invoice' });
        if (updatedSale) {
            currentSale = updatedSale;
            showToast(`Sale ${currentSale.id} is now an Invoice and remains open.`, 'success');
            updateCartDisplay(); // Reflect status change
            loadParkedSales(); // Open sales list will change
            closePaymentModal();
        } else {
            showToast("Failed to update sale to Invoice status.", 'error');
        }
    }

    async function handleSubmitPayment() {
        console.log("handleSubmitPayment function called."); 
        if (!currentSale || !currentSale.id) {
            showToast("Error: No current sale context for payment.", 'error');
            return;
        }
        const saleId = currentSale.id;
        let saleStatusBeforePayment = currentSale.status;

        const paymentType = paymentTypeSelect.value;
        const amount = parseFloat(paymentAmountInput.value);

        if (isNaN(amount) || amount <= 0) {
            showToast("Invalid payment amount.", 'error');
            return;
        }

        // If the sale is Open or Quote, and a payment is being made, change to Invoice first.
        if (saleStatusBeforePayment === 'Open' || saleStatusBeforePayment === 'Quote') {
            const updatedSaleStatus = await apiCall(`/sales/${saleId}/status`, 'PUT', { status: 'Invoice' });
            if (updatedSaleStatus) {
                currentSale = updatedSaleStatus; // Update currentSale with new status
                console.log(`Sale ${saleId} status updated to Invoice before payment.`);
            } else {
                showToast("Failed to update sale status to Invoice. Payment aborted.", 'error');
                return;
            }
        }

        const paymentData = {
            payment_type: paymentType,
            amount: amount.toFixed(2)
        };

        const saleAfterPayment = await apiCall(`/sales/${saleId}/payments`, 'POST', paymentData);
        if (saleAfterPayment) {
            currentSale = saleAfterPayment;
            updateCartDisplay();
            showToast(`Payment recorded. Sale ID: ${currentSale.id}, Status: ${currentSale.status}, Due: ${currentSale.amount_due.toFixed(2)}`, 'success');
            closePaymentModal();
            if (currentSale.status === 'Paid') {
                console.log("Sale is fully paid. Clearing cart.");
                currentSale = null; 
                currentCustomer = null;
                customerDetailsCartDiv.textContent = '';
                updateCartDisplay();
                loadParkedSales();
            }
        } else {
            showToast("Failed to record payment.", 'error');
        }
    }

    if (finalizeSaleButton) {
        finalizeSaleButton.addEventListener('click', handleFinalizeAndPay);
    } else {
        console.error("Finalize Sale Button not found in DOM!");
    }

    if (submitPaymentButton) {
        submitPaymentButton.addEventListener('click', handleSubmitPayment);
    } else {
        console.error("Submit Payment Button not found in DOM!"); 
    }

    if (invoiceRemainingButton) { 
        invoiceRemainingButton.addEventListener('click', handleInvoiceAndKeepOpen);
    } else {
        console.error("Invoice Remaining Button not found in DOM!");
    }

    // Close modal if user clicks outside of it
    window.addEventListener('click', (event) => {
        if (event.target == paymentModal) {
            closePaymentModal();
        }
    });

    // --- Customer Management Section Functions ---
    async function loadAndDisplayCustomers() {
        if (!customerMgmtListDiv) return; // Guard if the element doesn't exist on a page
        customerMgmtListDiv.innerHTML = '<p>Loading customers...</p>';
        const customers = await apiCall('/customers/');
        customerMgmtListDiv.innerHTML = ''; // Clear loading message
        if (customers && customers.length > 0) {
            const searchTerm = customerMgmtSearchInput.value.toLowerCase();
            customers
                .filter(customer => {
                    if (!searchTerm) return true;
                    return customer.name.toLowerCase().includes(searchTerm) || 
                           (customer.phone && customer.phone.toLowerCase().includes(searchTerm));
                })
                .forEach(customer => {
                    const custDiv = document.createElement('div');
                    custDiv.className = 'customer-list-item'; // For styling
                    custDiv.innerHTML = `
                        <div>
                            <strong>${customer.name}</strong> (${customer.phone || 'No phone'})<br>
                            ${customer.email || 'No email'}<br>
                            Address: ${customer.address || 'N/A'}<br>
                            Company: ${customer.company_name || 'N/A'}
                        </div>
                        <div>
                            <button class="edit-customer-btn" data-customer-id="${customer.id}">Edit</button>
                            <button class="select-customer-for-sale-btn" data-customer-id="${customer.id}" style="background-color: #337ab7; margin-left: 5px;">Select for Sale</button>
                        </div>
                    `;
                    custDiv.querySelector('.edit-customer-btn').addEventListener('click', () => openEditCustomerModal(customer.id));
                    custDiv.querySelector('.select-customer-for-sale-btn').addEventListener('click', async () => {
                        currentCustomer = customer;
                        if (customerDetailsCartDiv) {
                            customerDetailsCartDiv.textContent = `Selected: ${customer.name} (${customer.phone})`;
                        }
                        if (currentSale && currentSale.id) {
                            const updatedSale = await apiCall(`/sales/${currentSale.id}`, 'PUT', { customer_id: customer.id });
                            if (updatedSale) {
                                currentSale = updatedSale; // Update sale with customer
                                showToast(`Customer ${customer.name} associated with current sale.`, 'success');
                            } else {
                                showToast(`Failed to associate customer ${customer.name} with current sale.`, 'error');
                            }
                        } else {
                            showToast(`Customer ${customer.name} selected. Will be used for next sale.`, 'info');
                        }
                    });
                    customerMgmtListDiv.appendChild(custDiv);
                });
        } else {
            customerMgmtListDiv.innerHTML = '<p>No customers found. Click "Add New Customer" to add one.</p>';
        }
    }

    function openEditCustomerModal(customerId) {
        apiCall(`/customers/${customerId}`).then(customer => {
            if (customer) {
                editCustomerIdInput.value = customer.id;
                editCustomerNameInput.value = customer.name;
                editCustomerPhoneInput.value = customer.phone;
                editCustomerEmailInput.value = customer.email || '';
                editCustomerAddressInput.value = customer.address || '';
                editCustomerCompanyInput.value = customer.company_name || '';
                editCustomerModal.style.display = 'block';
            }
        });
    }

    function closeEditCustomerModal() {
        editCustomerModal.style.display = 'none';
    }

    async function handleUpdateCustomer() {
        const id = editCustomerIdInput.value;
        const name = editCustomerNameInput.value.trim();
        const phone = editCustomerPhoneInput.value.trim();
        const email = editCustomerEmailInput.value.trim();
        const address = editCustomerAddressInput.value.trim();
        const company = editCustomerCompanyInput.value.trim();

        if (!name || !phone) {
            showToast('Name and Phone are required for updating customer.', 'error');
            return;
        }

        const customerData = { name, phone, email, address, company_name: company };
        const updatedCustomer = await apiCall(`/customers/${id}`, 'PUT', customerData);

        if (updatedCustomer) {
            showToast('Customer updated successfully!', 'success');
            closeEditCustomerModal();
            loadAndDisplayCustomers(); // Refresh the list
            // If this customer is the currentCustomer for the cart, update that too
            if (currentCustomer && currentCustomer.id === parseInt(id)) {
                currentCustomer = updatedCustomer; // Assuming PUT returns the updated customer object
                 if(customerDetailsCartDiv) customerDetailsCartDiv.textContent = `Selected: ${updatedCustomer.name} (${updatedCustomer.phone})`;
            }
        }
    }

    // Event Listeners for Customer Management Section
    if (customerMgmtAddNewButton) {
        customerMgmtAddNewButton.addEventListener('click', openAddCustomerModal);
    }
    if (closeEditCustomerModalButton) {
        closeEditCustomerModalButton.addEventListener('click', closeEditCustomerModal);
    }
    if (submitUpdateCustomerButton) {
        submitUpdateCustomerButton.addEventListener('click', handleUpdateCustomer);
    }
    if (customerMgmtSearchInput) {
        customerMgmtSearchInput.addEventListener('input', loadAndDisplayCustomers); // Re-filter on input
    }

    // --- Variant Selection Modal Functions ---
    async function openVariantSelectionModal(parentItem) {
        if (!variantSelectionModal || !variantModalTitle || !variantListContainer) {
            console.error("Variant modal elements not found");
            return;
        }

        variantModalTitle.textContent = `Select Variant for ${parentItem.title}`;
        variantListContainer.innerHTML = '<p>Loading variants...</p>';
        variantSelectionModal.style.display = 'block';

        const variants = await apiCall(`/items/${parentItem.id}/variants`);

        variantListContainer.innerHTML = ''; // Clear loading message

        if (variants && variants.length > 0) {
            variants.forEach(variant => {
                const variantDiv = document.createElement('div');
                variantDiv.className = 'variant-item'; // For styling
                variantDiv.innerHTML = `
                    <strong>${variant.title}</strong> (SKU: ${variant.sku}) - $${variant.price ? variant.price.toFixed(2) : 'N/A'}<br>
                    Stock: ${variant.is_stock_tracked ? variant.stock_quantity : 'Not Tracked'}
                    <button class="add-variant-to-cart-btn" data-variant-id="${variant.id}" data-variant-price="${variant.price}">Add to Cart</button>
                `;
                variantDiv.querySelector('.add-variant-to-cart-btn').addEventListener('click', () => {
                    addItemToCart(variant.id, variant.price);
                    closeVariantSelectionModal();
                });
                variantListContainer.appendChild(variantDiv);
            });
        } else if (variants) { // Empty array
            variantListContainer.innerHTML = '<p>No variants available for this item.</p>';
        } else { // API call failed
            variantListContainer.innerHTML = '<p>Error loading variants. Please try again.</p>';
        }
    }

    function closeVariantSelectionModal() {
        if (variantSelectionModal) {
            variantSelectionModal.style.display = 'none';
        }
    }

    // --- All Sales Search Functions ---
    async function searchAllSales() {
        if (!allSalesSearchResultsDiv) return;
        allSalesSearchResultsDiv.innerHTML = '<p>Searching sales...</p>';

        const saleId = searchSaleIdInput.value.trim();
        const customerQuery = searchSaleCustomerInput.value.trim();
        const status = searchSaleStatusSelect.value;

        const queryParams = {};
        if (saleId) queryParams.sale_id = saleId;
        if (customerQuery) queryParams.customer_query = customerQuery;
        if (status) queryParams.status = status;

        const sales = await apiCall('/sales/', 'GET', null, queryParams);

        allSalesSearchResultsDiv.innerHTML = ''; // Clear loading/previous results
        if (sales && sales.length > 0) {
            sales.forEach(sale => {
                const saleDiv = document.createElement('div');
                saleDiv.className = 'sale-search-result-item'; // For styling
                let customerName = 'N/A';
                if (sale.customer) {
                    customerName = `${sale.customer.name} (${sale.customer.phone || 'No phone'})`;
                }

                saleDiv.innerHTML = `
                    <strong>Sale ID: ${sale.id}</strong> (Status: ${sale.status})<br>
                    Customer: ${customerName}<br>
                    Date: ${new Date(sale.created_at).toLocaleString()}<br>
                    Total: $${sale.sale_total.toFixed(2)} | Paid: $${sale.amount_paid.toFixed(2)} | Due: $${sale.amount_due.toFixed(2)}
                    <br>
                    Items: ${sale.sale_items.length}
                    <button class="view-sale-details-btn" data-sale-id="${sale.id}" style="margin-left: 10px; background-color: #5bc0de;">View/Load</button>
                `;
                // Add event listener for the View/Load button
                saleDiv.querySelector('.view-sale-details-btn').addEventListener('click', () => {
                    // For now, just load it into the cart. Later, could open a dedicated view.
                    loadSaleIntoCart(sale.id);
                    alert(`Sale ${sale.id} loaded into cart.`);
                    // Optionally, scroll to cart section or highlight it
                });
                allSalesSearchResultsDiv.appendChild(saleDiv);
            });
        } else if (sales) { // sales is an empty array
            allSalesSearchResultsDiv.innerHTML = '<p>No sales found matching your criteria.</p>';
        } else { // sales is null (API call failed)
            allSalesSearchResultsDiv.innerHTML = '<p>Error searching sales. Please try again.</p>';
        }
    }

    // --- Add/Edit Item Modal Functions ---
    function clearItemModalForm() {
        editItemIdInput.value = '';
        itemTitleInput.value = '';
        itemSkuInput.value = '';
        itemPriceInput.value = '';
        itemStockQuantityInput.value = '';
        itemDescriptionInput.value = '';
        itemParentIdInput.value = '-1'; // Default to standalone
        itemIsStockTrackedCheckbox.checked = true;
        itemShowOnWebsiteCheckbox.checked = false;
        itemIsActiveCheckbox.checked = true;
        document.getElementById('item-images-upload').value = null; // Clear file input
        document.getElementById('item-images-list').innerHTML = ''; // Clear displayed images
        manageVariantsButton.style.display = 'none'; // Hide manage variants button
        manageVariantsButton.onclick = null; // Remove any previous onclick handler
    }

    function openAddItemForm() {
        if (!addEditItemModal) return;
        clearItemModalForm();
        itemModalTitle.textContent = 'Add New Item';
        addEditItemModal.style.display = 'block';
    }

    async function openEditItemForm(itemId) {
        clearItemModalForm(); // Clear form first, including image areas
        itemModalTitle.textContent = 'Edit Item';
        editItemIdInput.value = itemId;

        const itemData = await apiCall(`/items/${itemId}`);
        if (itemData) {
            itemTitleInput.value = itemData.title;
            itemSkuInput.value = itemData.sku;
            itemPriceInput.value = itemData.price.toFixed(2);
            itemStockQuantityInput.value = itemData.stock_quantity;
            itemDescriptionInput.value = itemData.description || '';
            itemParentIdInput.value = itemData.parent_id;
            itemIsStockTrackedCheckbox.checked = itemData.is_stock_tracked;
            itemShowOnWebsiteCheckbox.checked = itemData.show_on_website;
            itemIsActiveCheckbox.checked = itemData.is_active;

            // Display existing images
            const itemImagesListDiv = document.getElementById('item-images-list');
            itemImagesListDiv.innerHTML = ''; // Ensure it's clear before populating
            if (itemData.photos && itemData.photos.length > 0) {
                itemData.photos.forEach(photo => {
                    const photoContainer = document.createElement('div');
                    photoContainer.className = 'image-preview-container';

                    const img = document.createElement('img');
                    img.src = photo.small_url; 
                    img.alt = itemData.title + ' image';
                    img.className = 'image-preview';
                    photoContainer.appendChild(img);

                    if (photo.is_primary) {
                        const primaryIndicator = document.createElement('span');
                        primaryIndicator.className = 'primary-image-indicator';
                        primaryIndicator.textContent = 'Primary';
                        photoContainer.appendChild(primaryIndicator);
                    }

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-image-btn';
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.dataset.photoId = photo.id;
                    deleteBtn.dataset.itemId = itemData.id; 
                    deleteBtn.onclick = () => handleDeleteImage(itemData.id, photo.id); // Wire up the handler
                    photoContainer.appendChild(deleteBtn);
                    
                    photoContainer.id = `photo-preview-${photo.id}`; // Add ID to the container for easy removal
                    itemImagesListDiv.appendChild(photoContainer);
                });
            }

            if (itemData.parent_id === -2) { // Is a parent item
                manageVariantsButton.style.display = 'block';
                manageVariantsButton.onclick = () => {
                    // Implement or call function to manage variants for this item
                    console.log(`Manage variants for parent item ID: ${itemData.id}`);
                    openVariantManagementInterface(itemData); // Placeholder for variant management UI
                };
            } else {
                manageVariantsButton.style.display = 'none';
            }

            addEditItemModal.style.display = 'flex';
        } else {
            showToast("Failed to load item details for editing.", 'error');
        }
    }

    function closeAddEditItemModal() {
        if (addEditItemModal) {
            addEditItemModal.style.display = 'none';
            manageVariantsButton.style.display = 'none'; // Ensure it's hidden on close
        }
    }

    async function handleSaveItem() {
        const itemId = editItemIdInput.value;
        const title = itemTitleInput.value.trim();
        const sku = itemSkuInput.value.trim();
        const price = parseFloat(itemPriceInput.value);
        const stockQuantity = parseInt(itemStockQuantityInput.value) || 0;
        const description = itemDescriptionInput.value.trim();
        const parentId = parseInt(itemParentIdInput.value) || -1;
        const isStockTracked = itemIsStockTrackedCheckbox.checked;
        const showOnWebsite = itemShowOnWebsiteCheckbox.checked;
        const isActive = itemIsActiveCheckbox.checked;

        if (!title || !price) { // Basic validation
            showToast('Title and Price are required for item.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('sku', sku);
        formData.append('price', price.toString()); // FormData converts numbers to strings anyway
        formData.append('stock_quantity', stockQuantity.toString());
        formData.append('description', description);
        formData.append('parent_id', parentId.toString());
        formData.append('is_stock_tracked', isStockTracked ? 'true' : 'false');
        formData.append('show_on_website', showOnWebsite ? 'true' : 'false');
        formData.append('is_active', isActive ? 'true' : 'false');

        // Append image files
        const imageUploadInput = document.getElementById('item-images-upload');
        if (imageUploadInput.files.length > 0) {
            for (let i = 0; i < imageUploadInput.files.length; i++) {
                formData.append('images', imageUploadInput.files[i]);
            }
        }

        let result;
        if (itemId) { // Update existing item
            result = await apiCall(`/items/${itemId}`, 'PUT', formData);
        } else { // Create new item
            result = await apiCall('/items/', 'POST', formData);
        }

        if (result) {
            showToast(itemId ? 'Item updated successfully!' : 'Item created successfully!', 'success');
            closeAddEditItemModal();
            searchItems(); // Refresh item list or relevant display
        } else {
            // Error already alerted by apiCall
            // alert(itemId ? 'Failed to update item.' : 'Failed to create item.');
        }
    }

    async function handleDeleteImage(itemId, photoId) {
        // if (!confirm('Are you sure you want to delete this image?')) {
        //     return;
        // }
        // For now, we will proceed without explicit confirm, just notify.
        // A modal confirmation could be a future enhancement.
        showToast('Attempting to delete image...', 'info', 1500); 

        const result = await apiCall(`/items/${itemId}/photos/${photoId}`, 'DELETE');
        if (result && result.message) { 
            // alert('Image deleted successfully.');
            showToast('Image deleted successfully.', 'success');
        } else {
            // Error should have been alerted by apiCall or caught if result is null
            // showToast('Failed to delete image. See console for details.', 'error'); 
            console.error("Failed to delete image, result:", result);
        }
    }

    // Initial Load and Setup
    loadParkedSales();
    loadAndDisplayCustomers(); // Load customers for the management section

    // Event Listener for All Sales Search
    if (searchSalesButton) {
        searchSalesButton.addEventListener('click', searchAllSales);
    }

    // Event Listener for Variant Selection Modal Close Button
    if (closeVariantSelectionModalButton) {
        closeVariantSelectionModalButton.addEventListener('click', closeVariantSelectionModal);
    }
    
    // Event Listeners for Add/Edit Item Modal
    if (openAddItemModalButton) { // This button needs to be added to HTML
        openAddItemModalButton.addEventListener('click', openAddItemForm);
    }
    if (closeAddEditItemModalButton) {
        closeAddEditItemModalButton.addEventListener('click', closeAddEditItemModal);
    }
    if (submitItemButton) {
        submitItemButton.addEventListener('click', handleSaveItem);
    }
    if (manageVariantsButton) {
        manageVariantsButton.addEventListener('click', () => {
            const parentItemId = manageVariantsButton.dataset.parentItemId;
            const parentItemSku = itemSkuInput.value; // Get SKU from the form (parent's SKU)
            const parentItemTitle = itemTitleInput.value; // Get Title from the form (parent's Title)

            if (parentItemId) {
                closeAddEditItemModal(); // Close the current edit modal
                
                // Open the item form in "Add New Item" mode
                openAddItemForm(); 
                
                // Pre-fill Parent ID and update modal title for adding a variant
                itemParentIdInput.value = parentItemId;
                itemModalTitle.textContent = `Add Variant for: ${parentItemTitle} (SKU: ${parentItemSku})`;
                
                // Optionally, you might want to clear or pre-fill other fields differently for variants
                // For example, SKU for a variant might follow a pattern like PARENT_SKU-VARIANT_CODE
                // For now, we let the user fill them or rely on auto SKU generation if blank.
                itemSkuInput.value = ''; // Clear SKU, let user define or auto-generate for variant
                itemTitleInput.value = parentItemTitle + ' - '; // Suggest a starting title
                itemPriceInput.focus(); // Focus on price for quick entry

            } else {
                showToast("Error: Parent item ID not found for managing variants.", 'error');
            }
        });
    }

    if (itemImageDropZone && itemImagesUploadInput) {
        itemImageDropZone.addEventListener('click', () => {
            itemImagesUploadInput.click(); // Trigger hidden file input
        });

        itemImagesUploadInput.addEventListener('change', () => {
            // Optionally display names of selected files from browse
            displaySelectedFileNames(itemImagesUploadInput.files);
        });

        itemImageDropZone.addEventListener('dragover', (event) => {
            event.preventDefault(); // Necessary to allow drop
            itemImageDropZone.classList.add('dragover');
        });

        itemImageDropZone.addEventListener('dragleave', (event) => {
            event.preventDefault();
            itemImageDropZone.classList.remove('dragover');
        });

        itemImageDropZone.addEventListener('drop', (event) => {
            event.preventDefault();
            itemImageDropZone.classList.remove('dragover');
            const files = event.dataTransfer.files;
            if (files.length > 0) {
                itemImagesUploadInput.files = files; // Assign dropped files to the input
                // Optionally display names of dropped files
                displaySelectedFileNames(files);
                showToast(`${files.length} file(s) selected.`, 'info');
            }
        });
    }

    function displaySelectedFileNames(fileList) {
        if (!itemImagesListDiv) return; // Should be itemImagesDisplayContainer or a new div for file names
        // For now, let's log to console, as itemImagesListDiv is for existing image previews.
        // A dedicated div to show names of files *to be uploaded* would be better.
        // Example: const fileNamesDiv = document.getElementById('newly-selected-files-list');
        // fileNamesDiv.innerHTML = '';
        
        let names = [];
        for(let i=0; i < fileList.length; i++) {
            names.push(fileList[i].name);
        }
        console.log("Selected files for upload:", names.join(', '));
        // If you have a dedicated div for file names:
        // if (names.length > 0) fileNamesDiv.textContent = `Selected: ${names.join(', ')}`;
        // else fileNamesDiv.textContent = '';
    }

    // --- Quick Add Dashboard Functions ---
    async function loadQuickAddItems(pageNumber) {
        if (!quickAddGridContainer || !quickAddCurrentPageSpan) return;

        currentQuickAddPage = pageNumber;
        quickAddCurrentPageSpan.textContent = pageNumber;
        quickAddGridContainer.innerHTML = '<p>Loading quick items...</p>';
        quickAddGridContainer.classList.toggle('edit-mode', isQuickAddEditMode);

        let quickItems = await apiCall('/quick_add_items/', 'GET', null, { page: pageNumber });

        quickAddGridContainer.innerHTML = ''; // Clear loading message
        
        let finalItemsToRender = [];
        if (quickItems) {
            finalItemsToRender = [...quickItems];
        }

        // Add "Back" button dynamically if not on page 1
        // This button is treated like a special quick add item for rendering
        if (pageNumber > 1) {
            const backButtonData = {
                id: 'internal-back-btn', // Special ID for the back button, not from DB
                type: 'page_link',
                label: '< Back',
                target_page_number: 1, // Always go to page 1
                color: '#dddddd', // A default color for back button
                is_back_button: true // Custom flag to identify it
            };
            finalItemsToRender.unshift(backButtonData); // Add to the beginning
        }

        if (finalItemsToRender.length > 0) {
            finalItemsToRender.forEach(qItem => {
                const itemDiv = createQuickAddItemElement(qItem);
                quickAddGridContainer.appendChild(itemDiv);
            });
        } else if (quickItems && quickItems.length === 0 && pageNumber === 1) { // Empty array on page 1, no back button
            quickAddGridContainer.innerHTML = '<p>No quick add items configured for this page.</p>';
        } else if (!quickItems) { // API call failed
            quickAddGridContainer.innerHTML = '<p>Error loading quick add items.</p>';
        }

        // Show/hide home button (to go to page 1) - This logic is removed as Back button handles it.
        // if (quickAddHomeButton) {
        //     if (pageNumber > 1) {
        //         quickAddHomeButton.style.display = isQuickAddEditMode ? 'none' : 'inline-block'; 
        //     } else {
        //         quickAddHomeButton.style.display = 'none';
        //     }
        // }
        // Show page number info only if not on page 1
        if (quickAddPageInfoDiv) {
            quickAddPageInfoDiv.style.display = pageNumber > 1 ? 'block' : 'none';
        }
    }

    function createQuickAddItemElement(qItem) {
        const itemDiv = document.createElement('div');
        itemDiv.className = `quick-add-item type-${qItem.type}`;
        itemDiv.dataset.qaiId = qItem.id; // Store DB ID if it exists

        if (qItem.type === 'item' && qItem.primary_photo_small_url) {
            itemDiv.style.backgroundImage = `url('${qItem.primary_photo_small_url}')`;
            itemDiv.classList.add('has-image');
            // Add label as an inner span to control its appearance over the background
            const labelSpan = document.createElement('span');
            labelSpan.className = 'quick-add-item-image-label';
            labelSpan.textContent = qItem.label;
            itemDiv.appendChild(labelSpan);
        } else {
            itemDiv.textContent = qItem.label;
        }

        if (qItem.color && !(qItem.type === 'item' && qItem.primary_photo_small_url)) {
            // Only apply background color if not an item with an image (image takes precedence)
            itemDiv.style.backgroundColor = qItem.color;
        }

        // Click handler for view mode (or non-editable items in edit mode like 'Back')
        const itemClickHandler = () => {
            if (qItem.type === 'item') {
                if (qItem.item_id && qItem.item_price !== null && qItem.item_price !== undefined) {
                    addItemToCart(qItem.item_id, qItem.item_price);
                    showToast(`${qItem.label} added to cart.`, 'success');
                } else {
                    console.error('Quick add item is missing price or ID:', qItem);
                    showToast(`Data missing for ${qItem.label}. Cannot add.`, 'error');
                }
            } else if (qItem.type === 'page_link') {
                if (qItem.target_page_number) {
                    loadQuickAddItems(qItem.target_page_number);
                } else {
                    showToast('Target page not defined for link.', 'error');
                }
            }
        };

        if (isQuickAddEditMode && !qItem.is_back_button) {
            itemDiv.classList.add('editable');
            itemDiv.draggable = true;
            itemDiv.addEventListener('dragstart', (e) => handleQAIDragStart(e, itemDiv, qItem));
            itemDiv.addEventListener('dragend', handleQAIDragEnd);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-qai-btn';
            deleteBtn.innerHTML = '&times;'; // Close icon
            deleteBtn.title = 'Delete this item';
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); // Prevent triggering item click
                handleDeleteQuickAddItem(qItem.id, qItem.label);
            };
            itemDiv.appendChild(deleteBtn);
        } else {
            // For non-editable items (like Back button or when not in edit mode)
            itemDiv.addEventListener('click', itemClickHandler);
            if (qItem.is_back_button) {
                 itemDiv.classList.add('is-back-button'); // For specific styling/behavior if needed
            }
        }
        
        // Drag and Drop listeners for the grid container (for empty areas or reordering)
        // These are on the item itself in this version for simplicity with target
        itemDiv.addEventListener('dragover', handleQAIDragOver);
        itemDiv.addEventListener('drop', (e) => handleQAIDrop(e, itemDiv));

        return itemDiv;
    }

    // Quick Add Edit Mode Toggle -- Now a button
    if (quickAddEditModeBtn) {
        quickAddEditModeBtn.addEventListener('click', () => {
            isQuickAddEditMode = !isQuickAddEditMode; // Toggle state
            quickAddEditModeBtn.classList.toggle('active', isQuickAddEditMode); // For styling the button if needed
            
            if (quickAddControlsDiv) { // Show/hide the whole controls div
                quickAddControlsDiv.style.display = isQuickAddEditMode ? 'block' : 'none';
            }
            // if (quickAddEditActions) { // This span is inside quickAddControlsDiv now
            //     quickAddEditActions.style.display = isQuickAddEditMode ? 'inline-block' : 'none';
            // }
            loadQuickAddItems(currentQuickAddPage); // Reload to apply edit mode styles/buttons
        });
    }

    // --- Modal Opening/Closing --- 
    function openQuickAddNewItemModal() {
        if (!quickAddNewItemModal) return;
        qaiItemSearchInput.value = '';
        qaiItemSearchResultsDiv.innerHTML = '';
        quickAddNewItemModal.style.display = 'block';
    }
    function closeQuickAddNewItemModal() {
        if (quickAddNewItemModal) quickAddNewItemModal.style.display = 'none';
    }
    function openQuickAddNewPageLinkModal() {
        if (!quickAddNewPageLinkModal) return;
        qaiPageLinkLabelInput.value = '';
        qaiPageLinkTargetInput.value = '';
        qaiPageLinkColorInput.value = '#A0E7E5'; // Default color
        quickAddNewPageLinkModal.style.display = 'block';
    }
    function closeQuickAddNewPageLinkModal() {
        if (quickAddNewPageLinkModal) quickAddNewPageLinkModal.style.display = 'none';
    }

    if (quickAddNewItemBtn) quickAddNewItemBtn.addEventListener('click', openQuickAddNewItemModal);
    if (closeQuickAddNewItemModalBtn) closeQuickAddNewItemModalBtn.addEventListener('click', closeQuickAddNewItemModal);
    if (quickAddNewPageLinkBtn) quickAddNewPageLinkBtn.addEventListener('click', openQuickAddNewPageLinkModal);
    if (closeQuickAddNewPageLinkModalBtn) closeQuickAddNewPageLinkModalBtn.addEventListener('click', closeQuickAddNewPageLinkModal);

    // --- Add New Quick Add Item (Type: Item) ---
    async function handleSearchQAIItems() {
        const query = qaiItemSearchInput.value.trim();
        qaiItemSearchResultsDiv.innerHTML = '<p>Searching...</p>';
        const queryParams = {};
        if (query && !query.includes(' ')) queryParams.sku = query;
        if (query) queryParams.title_query = query;

        const items = await apiCall('/items/', 'GET', null, queryParams);
        qaiItemSearchResultsDiv.innerHTML = '';
        if (items && items.length > 0) {
            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'item-search-result-for-quickadd'; // For styling
                div.innerHTML = `${item.title} (SKU: ${item.sku}) - $${item.price ? item.price.toFixed(2) : 'N/A'}`;
                div.addEventListener('click', async () => {
                    if (item.price === null || item.price === undefined) {
                        showToast('Selected item does not have a price. Cannot add.', 'error');
                        return;
                    }
                    const newQaiData = {
                        page_number: currentQuickAddPage,
                        type: 'item',
                        label: item.title.substring(0, 50), // Max label length
                        item_id: item.id,
                        color: '#B4F8C8' // Default color for new items
                    };
                    const result = await apiCall('/quick_add_items/', 'POST', newQaiData);
                    if (result && !result.error) {
                        showToast(`'${item.title}' added to Quick Add page ${currentQuickAddPage}.`, 'success');
                        closeQuickAddNewItemModal();
                        loadQuickAddItems(currentQuickAddPage);
                    } else {
                        showToast(`Failed to add item: ${result ? result.error : 'Unknown error'}`, 'error');
                    }
                });
                qaiItemSearchResultsDiv.appendChild(div);
            });
        } else {
            qaiItemSearchResultsDiv.innerHTML = '<p>No items found.</p>';
        }
    }
    if (qaiItemSearchButton) qaiItemSearchButton.addEventListener('click', handleSearchQAIItems);
    if (qaiItemSearchInput) qaiItemSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearchQAIItems(); });

    // --- Add New Quick Add Item (Type: Page Link) ---
    async function handleAddQuickAddPageLink() {
        const label = qaiPageLinkLabelInput.value.trim();
        const targetPage = parseInt(qaiPageLinkTargetInput.value);
        const color = qaiPageLinkColorInput.value.trim() || '#FFAEBC'; // Default color for page links

        if (!label || isNaN(targetPage) || targetPage < 1) {
            showToast('Label and a valid Target Page Number are required.', 'error');
            return;
        }
        if (targetPage === currentQuickAddPage) {
            showToast('Cannot link to the current page.', 'warning');
            return;
        }

        const newQaiData = {
            page_number: currentQuickAddPage,
            type: 'page_link',
            label: label,
            target_page_number: targetPage,
            color: color
        };
        const result = await apiCall('/quick_add_items/', 'POST', newQaiData);
        if (result && !result.error) {
            showToast(`Page link '${label}' added to Quick Add page ${currentQuickAddPage}.`, 'success');
            closeQuickAddNewPageLinkModal();
            loadQuickAddItems(currentQuickAddPage);
        } else {
            showToast(`Failed to add page link: ${result ? result.error : 'Unknown error'}`, 'error');
        }
    }
    if (qaiSubmitNewPageLinkButton) qaiSubmitNewPageLinkButton.addEventListener('click', handleAddQuickAddPageLink);

    // --- Delete Quick Add Item ---
    async function handleDeleteQuickAddItem(qaiId, qaiLabel) {
        if (!qaiId || qaiId === 'internal-back-btn') { // Prevent deleting the internal back button
            showToast('This item cannot be deleted.', 'info');
            return;
        }
        // Using a simple confirm for now. Could be replaced with a custom modal confirm.
        if (!confirm(`Are you sure you want to delete '${qaiLabel || 'this item'}' from the Quick Add page?`)) {
            return;
        }
        const result = await apiCall(`/quick_add_items/${qaiId}`, 'DELETE');
        if (result && result.message) { // Backend returns {message: "..."} on success
            showToast(result.message, 'success');
            loadQuickAddItems(currentQuickAddPage); // Reload the current page
        } else {
            // Error toast is handled by apiCall, but we can log here if needed
            console.error("Failed to delete Quick Add Item, result:", result);
        }
    }

    // --- Drag and Drop for Reordering Quick Add Items ---
    function handleQAIDragStart(e, itemDiv, qaiData) {
        if (qaiData.is_back_button) { // Prevent dragging the back button
            e.preventDefault();
            return;
        }
        draggedQAI = itemDiv;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', itemDiv.dataset.qaiId); // Use DB ID for transfer
        setTimeout(() => {
            itemDiv.classList.add('dragging');
        }, 0);
    }

    function handleQAIDragEnd(e) {
        if (draggedQAI) {
            draggedQAI.classList.remove('dragging');
        }
        draggedQAI = null;
        // Clean up any visual cues on the grid itself if needed
    }

    function handleQAIDragOver(e) {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
    }

    async function handleQAIDrop(e, targetElement) {
        e.preventDefault();
        if (!draggedQAI || targetElement === draggedQAI || targetElement.classList.contains('is-back-button')) {
            // Don't drop on itself or on the back button
            if (draggedQAI) draggedQAI.classList.remove('dragging');
            draggedQAI = null;
            return;
        }

        // Determine new order based on DOM elements
        const allItems = Array.from(quickAddGridContainer.querySelectorAll('.quick-add-item:not(.is-back-button)'));
        const draggedIndex = allItems.indexOf(draggedQAI);
        const targetIndex = allItems.indexOf(targetElement);

        // Simple reordering logic: move dragged item before target item
        if (draggedIndex !== -1 && targetIndex !== -1) {
            // Create the new order of IDs
            const orderedItemElements = [...allItems];
            orderedItemElements.splice(draggedIndex, 1); // Remove dragged from old position
            orderedItemElements.splice(targetIndex, 0, draggedQAI); // Insert at new position
            
            const orderedIds = orderedItemElements.map(el => el.dataset.qaiId).filter(id => id && id !== 'internal-back-btn');

            if (orderedIds.length > 0) {
                const result = await apiCall(`/quick_add_items/page/${currentQuickAddPage}/reorder`, 'POST', { ordered_ids: orderedIds });
                if (result && result.message) {
                    showToast(result.message, 'success');
                } else {
                    showToast('Failed to reorder items.', 'error');
                }
            } else {
                showToast('No draggable items to reorder.', 'info');
            }
        } else {
            console.warn('Drag and drop elements not found in expected list.');
        }

        if (draggedQAI) draggedQAI.classList.remove('dragging');
        draggedQAI = null;
        loadQuickAddItems(currentQuickAddPage); // Always reload to reflect backend state accurately
    }

    // Initial load for Quick Add
    if (quickAddGridContainer) { // Ensure the section exists before trying to load
        loadQuickAddItems(currentQuickAddPage); 
    }

    // Remove event listener for old home button if it was there
    // if (quickAddHomeButton) {
    //     quickAddHomeButton.addEventListener('click', () => {
    //         loadQuickAddItems(1); // Navigate to page 1
    //     });
    // }

}); 