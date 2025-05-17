// Basic POS System - app.js
import { apiCall } from './apiService.js';
import { showToast } from './toastService.js';
import { state } from './uiState.js'; // Import the state object
import {
    createNewSale,
    addItemToCart,
    loadSaleIntoCart,
    updateCartCustomerDisplay,
    updateCartDisplay,
    handleUpdateCartItemQuantity,
    handleRemoveItemFromCart
} from './cart.js';
import {
    shrinkLeftPanel,
    expandLeftPanel,
    collapseParkedSales,
    expandParkedSales,
    expandItemSearchResults,
    collapseItemSearchResults,
    collapseQuickAddDashboard,
    expandQuickAddDashboard
} from './panelUtils.js';

import {
    initCustomerService,
    openAddCustomerModal as serviceOpenAddCustomerModal,
    handleSaveNewCustomer as serviceHandleSaveNewCustomer,
    loadAndDisplayCustomers as serviceLoadAndDisplayCustomers,
    openEditCustomerModal as serviceOpenEditCustomerModal,
    closeEditCustomerModal as serviceCloseEditCustomerModal,
    closeAddCustomerModal as serviceCloseAddCustomerModal,
    handleUpdateCustomer as serviceHandleUpdateCustomer
} from './customerService.js';

import {
    preloadItems as servicePreloadItems,
    searchItems as serviceSearchItems,
    openImagePreviewModal as serviceOpenImagePreviewModal,
    closeImagePreviewModal as serviceCloseImagePreviewModal,
    openVariantSelectionModal as serviceOpenVariantSelectionModal,
    closeVariantSelectionModal as serviceCloseVariantSelectionModal,
    openAddItemForm as serviceOpenAddItemForm,
    closeAddEditItemModal as serviceCloseAddEditItemModal,
    handleSaveItem as serviceHandleSaveItem,
    handleDeleteImage as serviceHandleDeleteImage,
    displaySelectedFileNames as serviceDisplaySelectedFileNames,
    handleManageVariantsClick as serviceHandleManageVariantsClick,
    setupItemImageDropZone as serviceSetupItemImageDropZone
} from './itemService.js';

// Potentially others as we continue refactoring (e.g., item search functions)

document.addEventListener('DOMContentLoaded', () => {
    console.log("POS App Loaded");

    // Initialize Customer Service with callbacks from app.js/cart.js
    initCustomerService(updateCartDisplay, createNewSale, updateCartCustomerDisplay);


    // UI Elements
    const itemSearchButton = document.getElementById('item-search-button');
    const itemClearSearchButton = document.getElementById('item-clear-search-button'); // New Clear Search Button
    
    // New UI Element Selectors for 3-panel layout
    const leftPanelExpandTag = document.getElementById('left-panel-expand-tag');

    const parkSaleButton = document.getElementById('park-sale-button');
    const finalizeSaleButton = document.getElementById('finalize-sale-button');
    const setQuoteStatusButton = document.getElementById('set-quote-status-button');
    const voidSaleButton = document.getElementById('void-sale-button');

    const parkedSalesListDiv = document.getElementById('parked-sales-list');

    // Payment Modal UI Elements
    const paymentModal = document.getElementById('paymentModal');
    const paymentModalSaleIdInput = document.getElementById('paymentModalSaleId');
    const paymentAmountInput = document.getElementById('paymentAmount');
    const invoiceRemainingButton = document.getElementById('invoiceRemainingButton');

    // Add Customer Modal UI Elements (references might still be needed for event listeners if not fully encapsulated)
    const addCustomerModal = document.getElementById('customerModal'); 
    const closeAddCustomerModalButton = document.getElementById('close-add-customer-modal');
    const submitNewCustomerButton = document.getElementById('submit-new-customer-button');
    const submitNewCustomerAndAddToSaleButton = document.getElementById('submit-new-customer-and-add-to-sale-button');

    // Customer Management Section UI Elements (references might still be needed for event listeners)
    const customerMgmtSearchInput = document.getElementById('customer-mgmt-search-input');
    const customerMgmtAddNewButton = document.getElementById('customer-mgmt-add-new-button');
    
    // Edit Customer Modal UI Elements (references might still be needed for event listeners)
    const editCustomerModal = document.getElementById('edit-customer-modal'); 
    const closeEditCustomerModalButton = document.getElementById('close-edit-customer-modal');
    const submitUpdateCustomerButton = document.getElementById('submit-update-customer-button');

    // All Sales Search UI Elements
    const searchSaleIdInput = document.getElementById('search-sale-id');
    const searchSaleCustomerInput = document.getElementById('search-sale-customer');
    const searchSaleStatusSelect = document.getElementById('search-sale-status');
    const searchSalesButton = document.getElementById('search-sales-button');
    const allSalesSearchResultsDiv = document.getElementById('all-sales-search-results');

    // Variant Selection Modal UI Elements
    const variantSelectionModal = document.getElementById('variant-selection-modal');
    const imagePreviewModal = document.getElementById('imagePreviewModal');
    const addEditItemModal = document.getElementById('add-edit-item-modal'); 
    const openAddItemModalButton = document.getElementById('open-add-item-modal-button');
    const closeAddEditItemModalButton = document.getElementById('close-add-edit-item-modal');
    const submitItemButton = document.getElementById('submit-item-button');
    const submitItemAndAddToCartButton = document.getElementById('submit-item-and-add-to-cart-button');
    const manageVariantsButton = document.getElementById('manage-variants-button');
    const itemImagesListDiv = document.getElementById('item-images-list');
    const itemImagesUploadInput = document.getElementById('item-images-upload');
    const closeVariantSelectionModalButton = document.getElementById('close-variant-selection-modal');
    const closeImagePreviewModalButton = document.getElementById('closeImagePreviewModal');

    // Quick Add Dashboard UI Elements
    const quickAddGridContainer = document.getElementById('quick-add-grid-container');
    const quickAddCurrentPageSpan = document.getElementById('quick-add-current-page');
    const quickAddPageInfoDiv = document.getElementById('quick-add-page-info');
    
    const quickAddEditModeBtn = document.getElementById('quick-add-edit-mode-btn');
    const quickAddControlsDiv = document.getElementById('quick-add-controls');
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

    // Edit Sale Item Modal UI elements
    const editSaleItemModal = document.getElementById('editSaleItemModal');
    const itemDiscountPercentInput = document.getElementById('itemDiscountPercent');
    const itemDiscountAbsoluteInput = document.getElementById('itemDiscountAbsolute');
    const cartItemsDiv = document.getElementById('cart-items');

    // --- Initial Load Functions ---
    async function loadParkedSales() {
        parkedSalesListDiv.innerHTML = '<p>Loading parked sales...</p>';
        const sales = await apiCall('/sales/status/Open');
        console.log("Fetched parked sales:", sales); // Log fetched sales
        parkedSalesListDiv.innerHTML = ''; // Clear loading
        if (sales && sales.length > 0) {
            sales.forEach(sale => {
                const saleDiv = document.createElement('div');
                // Corrected to use sale_total as per backend `sale_to_dict`
                const totalDisplay = sale.sale_total !== undefined && sale.sale_total !== null ? sale.sale_total.toFixed(2) : '0.00';
                saleDiv.innerHTML = `Sale ID: ${sale.id} - Customer: ${sale.customer ? sale.customer.name : 'N/A'} - Total: ${totalDisplay}`;
                saleDiv.style.cursor = 'pointer';
                saleDiv.style.padding = '5px';
                saleDiv.style.borderBottom = '1px solid #eee';
                saleDiv.onclick = () => loadSaleIntoCart(sale.id);
                parkedSalesListDiv.appendChild(saleDiv);
            });
        } else {
            parkedSalesListDiv.innerHTML = '<p>No parked sales.</p>';
        }
        // Initial state of parked sales section depends on cart, managed by updateCartDisplay
        updateCartDisplay(); 
    }
    
    // --- Core Functionality ---

    // --- Finalize and Pay --- 
    async function handleFinalizeAndPay() {
        console.log("handleFinalizeAndPay called. currentSale:", state.currentSale, "currentCustomer:", state.currentCustomer); // Log currentSale and currentCustomer
        if (!state.currentSale || !state.currentSale.id) {
            showToast("No active sale to finalize.", 'warning');
            return;
        }

        if (!state.currentSale.customer_id) {
            showToast("Please associate a customer with the sale before finalizing.", 'warning');
            return;
        }

        let saleToProcess = state.currentSale;

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
        paymentModalSaleIdInput.value = sale.id;
        paymentAmountInput.value = sale.amount_due.toFixed(2);
        // paymentTypeSelect.value = 'Cash'; // REMOVED: paymentTypeSelect is being removed from HTML
        paymentModal.style.display = 'block';

        // Conditionally show/hide the "Invoice & Keep Open" button
        if (sale.status === 'Open' || sale.status === 'Quote') {
            invoiceRemainingButton.style.display = 'inline-block';
        } else {
            invoiceRemainingButton.style.display = 'none';
        }
    }

    window.closePaymentModal = function() {
        if (paymentModal) { // Check if paymentModal element exists
            paymentModal.style.display = 'none';
        }
    }


    async function handleInvoiceAndKeepOpen() {
        console.log("handleInvoiceAndKeepOpen called");
        if (!state.currentSale || !state.currentSale.id || (state.currentSale.status !== 'Open' && state.currentSale.status !== 'Quote')) {
            showToast("This action is only valid for 'Open' or 'Quote' sales.", 'warning');
            return;
        }

        const updatedSale = await apiCall(`/sales/${state.currentSale.id}/status`, 'PUT', { status: 'Invoice' });
        if (updatedSale) {
            state.currentSale = updatedSale;
            showToast(`Sale ${state.currentSale.id} is now an Invoice and remains open.`, 'success');
            updateCartDisplay(); // Reflect status change
            loadParkedSales(); // Open sales list will change
            closePaymentModal();
        } else {
            showToast("Failed to update sale to Invoice status.", 'error');
        }
    }

    // Modified to accept paymentType as an argument
    async function handleSubmitPayment(paymentType) { 
        const callId = Date.now(); // Unique ID for this call for logging
        console.log(`[${callId}] handleSubmitPayment CALLED with type: ${paymentType}, currentSale status: ${state.currentSale ? state.currentSale.status : 'N/A'}`);

        if (!state.currentSale || !state.currentSale.id) {
            showToast("No active sale to process payment for.", "error");
            console.log(`[${callId}] Aborting: No state.currentSale or state.currentSale.id`);
            return;
        }

        // If current sale is already paid, prevent further processing.
        if (state.currentSale.status === 'Paid') {
            showToast("This sale is already marked as Paid.", "info");
            console.log(`[${callId}] Aborting: Sale already Paid.`);
            // Cart should have been cleared by previous successful payment. If not, this is a state issue.
            // For now, we assume it was cleared or will be by a pending timeout from the first call.
            return; 
        }

        const amountText = paymentAmountInput.value;
        const amount = parseFloat(amountText);

        if (isNaN(amount) || amount <= 0) {
            showToast("Invalid payment amount.", "error");
            paymentAmountInput.focus();
            console.log(`[${callId}] Aborting: Invalid payment amount.`);
            return;
        }

        // If sale is 'Open' or 'Quote', it should become 'Invoice' before payment.
        if (state.currentSale.status === 'Open' || state.currentSale.status === 'Quote') {
            console.log(`[${callId}] Updating sale status to Invoice...`);
            const statusUpdate = await apiCall(`/sales/${state.currentSale.id}/status`, 'PUT', { status: 'Invoice' });
            if (statusUpdate && statusUpdate.id) {
                state.currentSale = statusUpdate; // Update currentSale with new status and potentially totals
                updateCartDisplay(); // Refresh cart display with new status
                showToast(`Sale status updated to ${state.currentSale.status}.`, "info");
                console.log(`[${callId}] Sale status updated to: ${state.currentSale.status}`);
            } else {
                showToast("Failed to update sale status to Invoice before payment. Aborting payment.", "error");
                console.log(`[${callId}] Aborting: Failed to update status to Invoice.`);
                return;
            }
        }
        
        // Re-check status before making payment, in case the status update changed things or another call intervened.
        if (state.currentSale.status === 'Paid') {
            showToast("Sale became Paid during status update. No further payment needed.", "info");
            console.log(`[${callId}] Aborting: Sale became Paid during status update phase.`);
            return;
        }
        console.log(`[${callId}] Proceeding to record payment. Sale status: ${state.currentSale.status}`);

        const paymentData = {
            amount: amount,
            payment_type: paymentType,
        };

        const paymentResult = await apiCall(`/sales/${state.currentSale.id}/payments`, 'POST', paymentData);

        // Assuming paymentResult from API is the updated sale object itself, as suggested by logs
        if (paymentResult && paymentResult.id) { // Check if it's a valid sale object by checking for an id
            state.currentSale = paymentResult; // Assign the sale object directly
            console.log(`[${callId}] Payment recorded. New sale status: ${state.currentSale.status}`);
            showToast(`Payment of $${amount.toFixed(2)} via ${paymentType} recorded successfully.`, "success");
            updateCartDisplay(); 
            closePaymentModal();

            if (state.currentSale.status === 'Paid') {
                console.log(`[${callId}] Sale is now PAID. Setting timeout to clear cart.`);
                showToast(`Sale ${state.currentSale.id} is now fully Paid. Clearing cart.`, "info");
                setTimeout(() => {
                    console.log(`[${callId}] Timeout: Clearing cart for sale ID ${state.currentSale ? state.currentSale.id : 'N/A'} which was PAID.`);
                    // Ensure it's the same sale that was paid by this specific function call's context
                    if (state.currentSale && state.currentSale.status === 'Paid' && paymentResult.id === state.currentSale.id) { 
                        state.currentSale = null; 
                        state.currentCustomer = null;
                        updateCartDisplay(); 
                        loadParkedSales(); 
                        console.log(`[${callId}] Timeout: Cart cleared and parked sales reloaded.`);
                    } else {
                         console.log(`[${callId}] Timeout: Cart not cleared. state.currentSale status: ${state.currentSale ? state.currentSale.status : 'N/A'} or state.currentSale is null, or ID mismatch.`);
                    }
                }, 1500);
            }
        } else {
            // This 'else' block might be hit if paymentResult is null (apiCall failure) 
            // or if it's not a valid sale object (e.g., an error message object from backend without an 'id')
            showToast("Failed to record payment or received invalid response.", "error");
            console.log(`[${callId}] Payment recording failed or invalid response. paymentResult:`, paymentResult);
            // Do not clear cart here if payment failed.
        }
    }

    // Remove or comment out the old submitPaymentButton listener if it exists and the button is removed from HTML
    // if (submitPaymentButton) {
    //     submitPaymentButton.addEventListener('click', handleSubmitPayment); // This would now be problematic without type
    // } else {
    //     console.error("Submit Payment Button not found in DOM!"); 
    // }

    // Add event listeners for new payment method buttons
    const payCashButton = document.getElementById('payCashButton');
    const payChequeButton = document.getElementById('payChequeButton');
    const payEftposButton = document.getElementById('payEftposButton');

    if (payCashButton) {
        payCashButton.addEventListener('click', () => handleSubmitPayment('Cash'));
    }
    if (payChequeButton) {
        payChequeButton.addEventListener('click', () => handleSubmitPayment('Cheque'));
    }
    if (payEftposButton) {
        payEftposButton.addEventListener('click', () => handleSubmitPayment('EFTPOS'));
    }

    if (finalizeSaleButton) {
        finalizeSaleButton.addEventListener('click', handleFinalizeAndPay);
    } else {
        console.error("Finalize Sale Button not found in DOM!");
    }

    // Close modal if user clicks outside of it
    window.addEventListener('click', (event) => {
        if (event.target == paymentModal) {
            closePaymentModal();
        }
        if (event.target == variantSelectionModal) serviceCloseVariantSelectionModal(); // From itemService
        if (event.target == addEditItemModal) serviceCloseAddEditItemModal();     // From itemService
        if (event.target == imagePreviewModal) serviceCloseImagePreviewModal();    // From itemService
    });

    async function parkCurrentSale() {
        if (state.currentSale && state.currentSale.id) {
            let saleToParkStatus = state.currentSale.status;
            // Only allow parking for 'Open', 'Quote', 'Invoice' that are not yet fully paid.
            // If it's already 'Open' or 'Quote', no status change needed for parking itself.
            // If it's 'Invoice', it can be parked (cleared from view).
            if (saleToParkStatus !== 'Open' && saleToParkStatus !== 'Quote' && saleToParkStatus !== 'Invoice') {
                showToast(`Sale is ${saleToParkStatus}. Cannot be parked.`, 'warning');
                return;
            }

            showToast(`Sale ${state.currentSale.id} (${state.currentSale.status}) parked.`, "info");
            
            state.currentSale = null;
            state.currentCustomer = null; 
            updateCartDisplay(); 
            loadParkedSales(); 
        } else {
            showToast("No active sale to park.", "info");
        }
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

    // Initial Load and Setup
    servicePreloadItems(); // Call item service to preload
    loadParkedSales();
    serviceLoadAndDisplayCustomers(); // Initial load of customers using the service
    updateCartDisplay(); // Initial cart display and panel state setup
    loadQuickAddItems(state.currentQuickAddPage);

    // Event Listener for All Sales Search
    if (searchSalesButton) {
        searchSalesButton.addEventListener('click', searchAllSales);
    }

    // Event Listener for Variant Selection Modal Close Button
    if (closeVariantSelectionModalButton) {
        closeVariantSelectionModalButton.addEventListener('click', serviceCloseVariantSelectionModal);
    }
    
    // --- Quick Add Dashboard Functions ---
    function toggleQuickAddEditMode() {
        state.isQuickAddEditMode = !state.isQuickAddEditMode;
        if (quickAddEditModeBtn) {
            quickAddEditModeBtn.classList.toggle('active', state.isQuickAddEditMode);
            quickAddEditModeBtn.innerHTML = state.isQuickAddEditMode ? '&#128736;' : '&#9998;'; // Save/Done icon vs Edit icon
        }
        if (quickAddControlsDiv) {
            quickAddControlsDiv.style.display = state.isQuickAddEditMode ? 'block' : 'none';
        }
        loadQuickAddItems(state.currentQuickAddPage); // Reload to apply edit mode styles/buttons to items
    }

    async function loadQuickAddItems(pageNumber) {
        if (!quickAddGridContainer || !quickAddCurrentPageSpan) return;

        state.currentQuickAddPage = pageNumber;
        quickAddCurrentPageSpan.textContent = pageNumber;
        quickAddGridContainer.innerHTML = '<p>Loading quick items...</p>';
        quickAddGridContainer.classList.toggle('edit-mode', state.isQuickAddEditMode);

        // MODIFICATION START
        state.quickAddItemsCache = []; // Clear cache before loading new items
        const fetchedQuickItems = await apiCall('/quick_add_items/', 'GET', null, { page: pageNumber });
        
        quickAddGridContainer.innerHTML = ''; // Clear loading message
        
        let finalItemsToRender = [];
        if (fetchedQuickItems && Array.isArray(fetchedQuickItems)) {
            state.quickAddItemsCache = [...fetchedQuickItems]; // Populate the cache
            finalItemsToRender = [...fetchedQuickItems];
        } else if (fetchedQuickItems && typeof fetchedQuickItems === 'object' && fetchedQuickItems !== null && fetchedQuickItems.id !== undefined) {
            // Handle case where API might return a single object if only one item
            // Though ideally API should consistently return an array
            console.warn("API returned a single object for quick items, wrapping in array:", fetchedQuickItems);
            state.quickAddItemsCache = [fetchedQuickItems];
            finalItemsToRender = [fetchedQuickItems];
        } else if (fetchedQuickItems === null || (Array.isArray(fetchedQuickItems) && fetchedQuickItems.length === 0) ) {
            // API call was successful but returned no items or null (treat as empty)
            // state.quickAddItemsCache remains []
            // finalItemsToRender remains []
        }
        else if (!fetchedQuickItems) { // API call failed (apiCall returns null on failure)
             quickAddGridContainer.innerHTML = '<p>Error loading quick add items.</p>';
             // state.quickAddItemsCache remains []
             // finalItemsToRender remains []
        }
        // MODIFICATION END

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
            // Add to the beginning of finalItemsToRender, not state.quickAddItemsCache
            finalItemsToRender.unshift(backButtonData); 
        }

        if (finalItemsToRender.length > 0) {
            finalItemsToRender.forEach(qItem => {
                const itemDiv = createQuickAddItemElement(qItem);
                quickAddGridContainer.appendChild(itemDiv);
            });
        } else if (pageNumber === 1) { 
            // If still empty after potential back button logic (e.g. API error made finalItemsToRender empty)
            // and it's page 1 (so no back button was added, or it was the only thing)
            // Check state.quickAddItemsCache specifically for "no configured items" message
            if(state.quickAddItemsCache.length === 0 && !quickAddGridContainer.textContent.includes("Error loading")) {
                 quickAddGridContainer.innerHTML = '<p>No quick add items configured for this page.</p>';
            }
        } 
        // If not page 1, and finalItemsToRender is empty, it means only back button would be there,
        // or error occurred. createQuickAddItemElement handles back button fine.
        // The error message is already set if API call failed.

        // Show/hide page number info only if not on page 1
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

        if (state.isQuickAddEditMode && !qItem.is_back_button) {
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
                        page_number: state.currentQuickAddPage,
                        type: 'item',
                        label: item.title.substring(0, 50), // Max label length
                        item_id: item.id,
                        color: '#B4F8C8' // Default color for new items
                    };
                    const result = await apiCall('/quick_add_items/', 'POST', newQaiData);
                    if (result && !result.error) {
                        showToast(`'${item.title}' added to Quick Add page ${state.currentQuickAddPage}.`, 'success');
                        closeQuickAddNewItemModal();
                        loadQuickAddItems(state.currentQuickAddPage);
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
        if (targetPage === state.currentQuickAddPage) {
            showToast('Cannot link to the current page.', 'warning');
            return;
        }

        const newQaiData = {
            page_number: state.currentQuickAddPage,
            type: 'page_link',
            label: label,
            target_page_number: targetPage,
            color: color
        };
        const result = await apiCall('/quick_add_items/', 'POST', newQaiData);
        if (result && !result.error) {
            showToast(`Page link '${label}' added to Quick Add page ${state.currentQuickAddPage}.`, 'success');
            closeQuickAddNewPageLinkModal();
            loadQuickAddItems(state.currentQuickAddPage);
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
            loadQuickAddItems(state.currentQuickAddPage); // Reload the current page
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
        state.draggedQAI = itemDiv;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', itemDiv.dataset.qaiId); // Use DB ID for transfer
        setTimeout(() => {
            itemDiv.classList.add('dragging');
        }, 0);
    }

    function handleQAIDragEnd(e) {
        if (state.draggedQAI) {
            state.draggedQAI.classList.remove('dragging');
        }
        state.draggedQAI = null;
        // Clean up any visual cues on the grid itself if needed
    }

    function handleQAIDragOver(e) {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
    }

    async function handleQAIDrop(e, targetElement) {
        e.preventDefault();
        if (!state.draggedQAI || targetElement === state.draggedQAI || targetElement.classList.contains('is-back-button')) {
            // Don't drop on itself or on the back button
            if (state.draggedQAI) state.draggedQAI.classList.remove('dragging');
            state.draggedQAI = null;
            return;
        }

        // Determine new order based on DOM elements
        const allItems = Array.from(quickAddGridContainer.querySelectorAll('.quick-add-item:not(.is-back-button)'));
        const draggedIndex = allItems.indexOf(state.draggedQAI);
        const targetIndex = allItems.indexOf(targetElement);

        // Simple reordering logic: move dragged item before target item
        if (draggedIndex !== -1 && targetIndex !== -1) {
            // Create the new order of IDs
            const orderedItemElements = [...allItems];
            orderedItemElements.splice(draggedIndex, 1); // Remove dragged from old position
            orderedItemElements.splice(targetIndex, 0, state.draggedQAI); // Insert at new position
            
            const orderedIds = orderedItemElements.map(el => el.dataset.qaiId).filter(id => id && id !== 'internal-back-btn');

            if (orderedIds.length > 0) {
                const result = await apiCall(`/quick_add_items/page/${state.currentQuickAddPage}/reorder`, 'POST', { ordered_ids: orderedIds });
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

        if (state.draggedQAI) state.draggedQAI.classList.remove('dragging');
        state.draggedQAI = null;
        loadQuickAddItems(state.currentQuickAddPage); // Always reload to reflect backend state accurately
    }

    // Initial load for Quick Add
    if (quickAddGridContainer) { // Ensure the section exists before trying to load
        quickAddGridContainer.addEventListener('dragstart', (e) => {
            const itemDiv = e.target.closest('.quick-add-item.editable:not(.is-back-button)');
            if(itemDiv) {
                const qaiId = itemDiv.dataset.qaiId; // This should be correct based on createQuickAddItemElement
                const qaiData = state.quickAddItemsCache.find(item => item.id && item.id.toString() === qaiId);
                if(qaiData) {
                    handleQAIDragStart(e, itemDiv, qaiData);
                } else {
                    console.warn('Could not find qaiData for ID:', qaiId, 'in cache:', state.quickAddItemsCache);
                    e.preventDefault(); // Prevent dragging if data isn't found
                }
            }
        });
    }

    // Edit Sale Item Modal listeners (if elements exist)
    if (itemDiscountPercentInput) {
        itemDiscountPercentInput.addEventListener('input', () => {
            const originalPrice = parseFloat(document.getElementById('editSaleItemOriginalPrice').value);
            const percent = parseFloat(itemDiscountPercentInput.value);
            if (!isNaN(originalPrice) && !isNaN(percent)) {
                const discountAbs = (originalPrice * percent) / 100;
                document.getElementById('itemDiscountAbsolute').value = discountAbs.toFixed(2);
                document.getElementById('itemFinalPrice').value = (originalPrice - discountAbs).toFixed(2);
            } else if (itemDiscountPercentInput.value === '') {
                document.getElementById('itemDiscountAbsolute').value = '';
                 document.getElementById('itemFinalPrice').value = originalPrice ? originalPrice.toFixed(2) : '';
            }
        });
    }

    if (itemDiscountAbsoluteInput) {
        itemDiscountAbsoluteInput.addEventListener('input', () => {
            const originalPrice = parseFloat(document.getElementById('editSaleItemOriginalPrice').value);
            const absolute = parseFloat(itemDiscountAbsoluteInput.value);
            if (!isNaN(originalPrice) && !isNaN(absolute)) {
                const discountPct = (absolute / originalPrice) * 100;
                document.getElementById('itemDiscountPercent').value = discountPct.toFixed(2);
                document.getElementById('itemFinalPrice').value = (originalPrice - absolute).toFixed(2);
            } else if (itemDiscountAbsoluteInput.value === '') {
                 document.getElementById('itemDiscountPercent').value = '';
                 document.getElementById('itemFinalPrice').value = originalPrice ? originalPrice.toFixed(2) : '';
            }
        });
    }

    // --- Sale Item Edit Modal Functions ---
    window.openEditSaleItemModal = function(saleItemId, originalPrice, currentSalePrice, currentNotes, itemName) {
        if (!editSaleItemModal) {
            console.error('Edit Sale Item Modal not found in DOM');
            showToast('Error: Edit item modal not found.', 'error');
            return;
        }
        console.log(`Opening edit modal for sale item ${saleItemId}, originalPrice: ${originalPrice}, currentSalePrice: ${currentSalePrice}, notes: '${currentNotes}', name: '${itemName}'`);

        document.getElementById('editSaleItemId').value = saleItemId;
        document.getElementById('editSaleItemOriginalPrice').value = originalPrice; // Store raw original price
        document.getElementById('editSaleItemName').textContent = itemName || 'N/A';
        document.getElementById('editSaleItemOriginalPriceDisplay').textContent = parseFloat(originalPrice).toFixed(2);
        
        document.getElementById('itemNotes').value = currentNotes || '';

        const discountPercentInput = document.getElementById('itemDiscountPercent');
        const discountAbsoluteInput = document.getElementById('itemDiscountAbsolute');
        const finalPriceInput = document.getElementById('itemFinalPrice');

        // Reset fields before populating
        discountPercentInput.value = '';
        discountAbsoluteInput.value = '';
        finalPriceInput.value = parseFloat(originalPrice).toFixed(2); // Default to original price

        // Populate from currentSalePrice if different from originalPrice (i.e., discount exists)
        if (parseFloat(currentSalePrice) < parseFloat(originalPrice)) {
            const discountAbsolute = parseFloat(originalPrice) - parseFloat(currentSalePrice);
            const discountPercent = (originalPrice > 0) ? (discountAbsolute / parseFloat(originalPrice)) * 100 : 0;
            
            discountAbsoluteInput.value = discountAbsolute.toFixed(2);
            if (originalPrice > 0) {
                 discountPercentInput.value = discountPercent.toFixed(2);
            }
            finalPriceInput.value = parseFloat(currentSalePrice).toFixed(2);
        } else {
            finalPriceInput.value = parseFloat(currentSalePrice).toFixed(2);
        }
        editSaleItemModal.style.display = 'block';
    }

    window.closeEditSaleItemModal = function() {
        if (editSaleItemModal) {
            editSaleItemModal.style.display = 'none';
        }
    }

    window.handleSaveSaleItemDetails = async function() {
        if (!state.currentSale || !state.currentSale.id) {
            showToast('No active sale to update.', 'error');
            return;
        }

        const saleItemId = document.getElementById('editSaleItemId').value;
        const originalPrice = parseFloat(document.getElementById('editSaleItemOriginalPrice').value);
        let finalPriceStr = document.getElementById('itemFinalPrice').value;
        const notes = document.getElementById('itemNotes').value;

        if (!saleItemId) {
            showToast('Error: Sale Item ID is missing.', 'error');
            return;
        }

        let salePriceToUpdate;
        if (finalPriceStr.trim() === '' || isNaN(parseFloat(finalPriceStr))) {
            salePriceToUpdate = originalPrice; 
            showToast('Final price was invalid, defaulting to original price for this item.', 'warning');
        } else {
            salePriceToUpdate = parseFloat(finalPriceStr);
        }

        if (salePriceToUpdate < 0) {
            showToast('Final price cannot be negative.', 'error');
            return;
        }

        const payload = {
            sale_price: salePriceToUpdate,
            notes: notes
        };

        try {
            const updatedSale = await apiCall(`/sales/${state.currentSale.id}/items/${saleItemId}`, 'PUT', payload);
            if (updatedSale) {
                state.currentSale = updatedSale; // Assuming backend returns the whole updated sale
                showToast('Item details updated successfully!', 'success');
            } else {
                // If API returns null or not the full sale, reload to be safe
                await loadSaleIntoCart(state.currentSale.id); 
                showToast('Item details updated! Refreshing cart.', 'success');
            }
            closeEditSaleItemModal();
            updateCartDisplay(); 
        } catch (error) {
            console.error('Error updating sale item details:', error);
            showToast(`Error updating item: ${error.message || 'Unknown error'}`, 'error');
        }
    }
    // --- End Sale Item Edit Modal Functions ---

    // Listener for stock quantity changes to affect other checkboxes
    const itemStockQuantityInputRef = document.getElementById('item-stock-quantity'); // Re-fetch for this specific listener
    if (itemStockQuantityInputRef) {
        itemStockQuantityInputRef.addEventListener('input', () => {
            const stockValue = parseInt(itemStockQuantityInputRef.value);
            // Check if it's a number and is 0. Allow empty string or non-zero without auto-unchecking.
            if (!isNaN(stockValue) && stockValue === 0) {
                const itemShowOnWebsiteCheckboxRef = document.getElementById('item-show-on-website');
                const itemIsActiveCheckboxRef = document.getElementById('item-is-active');
                if (itemShowOnWebsiteCheckboxRef) itemShowOnWebsiteCheckboxRef.checked = false;
                if (itemIsActiveCheckboxRef) itemIsActiveCheckboxRef.checked = false;
            }
        });
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

    // --- Event Listeners ---
    if (itemSearchButton) itemSearchButton.addEventListener('click', serviceSearchItems);
    if (itemClearSearchButton) {
        itemClearSearchButton.addEventListener('click', () => {
            if(itemSearchInput) itemSearchInput.value = '';
            serviceSearchItems(); // Calling with empty query will trigger collapse
        });
    }
    if (itemSearchInput) itemSearchInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') serviceSearchItems(); });


    if (leftPanelExpandTag) {
        leftPanelExpandTag.addEventListener('click', expandLeftPanel);
    }

    // --- Initial Load ---
    loadParkedSales();
    serviceLoadAndDisplayCustomers(); // Initial load of customers using the service
    updateCartDisplay(); // Initial cart display and panel state setup
    loadQuickAddItems(state.currentQuickAddPage);


    if (parkSaleButton) {
        parkSaleButton.addEventListener('click', parkCurrentSale);
    }

    if (setQuoteStatusButton) {
        setQuoteStatusButton.addEventListener('click', async () => {
            if (!state.currentSale || !state.currentSale.id) {
                showToast('No active sale to set as quote.', 'warning');
                return;
            }
            if (state.currentSale.status === 'Quote') {
                showToast('Sale is already a Quote.', 'info');
                return;
            }
            // Add other status checks if necessary (e.g., cannot quote a 'Paid' sale)
            if (state.currentSale.status === 'Paid' || state.currentSale.status === 'Void') {
                showToast(`Cannot set a '${state.currentSale.status}' sale to Quote.`, 'warning');
                return;
            }

            showToast('Setting sale as Quote...', 'info');
            const updatedSale = await apiCall(`/sales/${state.currentSale.id}/status`, 'PUT', { status: 'Quote' });
            if (updatedSale && updatedSale.id) {
                state.currentSale = updatedSale;
                showToast(`Sale ${state.currentSale.id} is now a Quote.`, 'success');
                updateCartDisplay();
                loadParkedSales(); // Quotes might appear in a different section or update parked sales list if it shows Quotes too
            } else {
                showToast('Failed to set sale as Quote.', 'error');
            }
        });
    }

    if (voidSaleButton) {
        voidSaleButton.addEventListener('click', async () => {
            if (!state.currentSale || !state.currentSale.id) {
                showToast('No active sale to void.', 'warning');
                return;
            }
            if (state.currentSale.status === 'Void') {
                showToast('Sale is already Void.', 'info');
                return;
            }
            // Add other status checks if necessary (e.g., rules for voiding 'Paid' sales - service layer should handle complex rules)
            if (state.currentSale.status === 'Paid') {
                 if (!confirm('This sale is PAID. Voiding a paid sale will attempt to reverse stock. Are you sure?')) {
                    return;
                }
            }

            showToast('Voiding sale...', 'info');
            const updatedSale = await apiCall(`/sales/${state.currentSale.id}/status`, 'PUT', { status: 'Void' });
            if (updatedSale && updatedSale.id && updatedSale.status === 'Void') {
                showToast(`Sale ${state.currentSale.id} has been Voided.`, 'success');
                state.currentSale = null; // Clear the active sale
                state.currentCustomer = null;
                updateCartDisplay(); // Refresh cart (should be empty)
                loadParkedSales(); // Refresh parked sales list as this sale might now be considered differently
            } else {
                showToast('Failed to void sale. The sale might still be active or in an unknown state.', 'error');
                // Optionally, refresh state.currentSale from server to get consistent state
                if (state.currentSale && state.currentSale.id) await loadSaleIntoCart(state.currentSale.id);
            }
        });
    }

    if (finalizeSaleButton) {
        finalizeSaleButton.addEventListener('click', handleFinalizeAndPay);
    } else {
        console.error("Finalize Sale Button not found in DOM!");
    }

    // Updated Customer Modal Listeners
    if (closeAddCustomerModalButton) {
        closeAddCustomerModalButton.addEventListener('click', serviceCloseAddCustomerModal);
    }
    if (submitNewCustomerButton) {
        submitNewCustomerButton.addEventListener('click', () => serviceHandleSaveNewCustomer(false));
    }
    if (submitNewCustomerAndAddToSaleButton) {
        submitNewCustomerAndAddToSaleButton.addEventListener('click', () => serviceHandleSaveNewCustomer(true));
    }
    
    window.addEventListener('click', (event) => {
        if (event.target == addCustomerModal) { // addCustomerModal is still defined locally for this check
            serviceCloseAddCustomerModal();
        }
        if (event.target == editCustomerModal) { // editCustomerModal is still defined locally for this check
            serviceCloseEditCustomerModal();
        }
        if (event.target == paymentModal) {
            closePaymentModal();
        }
        if (event.target == variantSelectionModal) {
            serviceCloseVariantSelectionModal();
        }
        if (event.target == addEditItemModal) {
            serviceCloseAddEditItemModal();
        }
        if (event.target == imagePreviewModal) { // New: Close image preview modal on outside click
            serviceCloseImagePreviewModal();
        }
        // Quick Add Modals
        if (event.target == quickAddNewItemModal) closeQuickAddNewItemModal();
        if (event.target == quickAddNewPageLinkModal) closeQuickAddNewPageLinkModal();
        if (event.target == editSaleItemModal) closeEditSaleItemModal();

    });

    // Updated Edit Customer Modal Listeners
    if (closeEditCustomerModalButton) {
        closeEditCustomerModalButton.addEventListener('click', serviceCloseEditCustomerModal);
    }
    if (submitUpdateCustomerButton) {
        submitUpdateCustomerButton.addEventListener('click', serviceHandleUpdateCustomer);
    }

    // Event listeners for main customer management add button
    if (customerMgmtAddNewButton) {
        customerMgmtAddNewButton.addEventListener('click', serviceOpenAddCustomerModal);
    }
    // Search listener for main customer management search
    if (customerMgmtSearchInput) {
        customerMgmtSearchInput.addEventListener('input', serviceLoadAndDisplayCustomers);
    }

    // Sales Search Section
    if(searchSalesButton) {
        searchSalesButton.addEventListener('click', searchAllSales);
    }

    // Variant Modal
    if (closeVariantSelectionModalButton) {
        closeVariantSelectionModalButton.addEventListener('click', serviceCloseVariantSelectionModal);
    }

    // Add/Edit Item Modal
    if (openAddItemModalButton) openAddItemModalButton.addEventListener('click', serviceOpenAddItemForm);
    if (closeAddEditItemModalButton) closeAddEditItemModalButton.addEventListener('click', serviceCloseAddEditItemModal);
    if (submitItemButton) submitItemButton.addEventListener('click', () => serviceHandleSaveItem(false));
    if (submitItemAndAddToCartButton) submitItemAndAddToCartButton.addEventListener('click', () => serviceHandleSaveItem(true));


    if (manageVariantsButton) manageVariantsButton.addEventListener('click', serviceHandleManageVariantsClick);


    // Image Drop Zone & Upload for Add/Edit Item Modal
    if (itemImagesUploadInput) {
        itemImagesUploadInput.addEventListener('change', () => serviceDisplaySelectedFileNames(itemImagesUploadInput.files));
    }
    
    // Delegated event listener for deleting images in Add/Edit Item Modal
    if (itemImagesListDiv) {
        itemImagesListDiv.addEventListener('click', function(event) {
            if (event.target.classList.contains('delete-image-btn')) {
                const photoId = event.target.dataset.photoId;
                const currentItemId = document.getElementById('edit-item-id').value; // Get current item id from the modal
                if (currentItemId && photoId) {
                    serviceHandleDeleteImage(currentItemId, photoId);
                } else {
                    showToast('Item ID or Photo ID missing for deletion.', 'error');
                }
            }
            if (event.target.classList.contains('set-primary-image-btn')) {
                const photoId = event.target.dataset.photoId;
                const itemId = editItemIdInput.value;
                if (itemId && photoId) {
                    handleSetPrimaryImage(itemId, photoId);
                }
            }
        });
    }

    // Payment Modal Buttons (using event listeners now)
    const payCashBtn = document.getElementById('payCashButton');
    const payChequeBtn = document.getElementById('payChequeButton');
    const payEftposBtn = document.getElementById('payEftposButton');
    // const invoiceRemainingBtn = document.getElementById('invoiceRemainingButton'); // Already defined

    // Commenting out these duplicate listeners
    // if (payCashBtn) payCashBtn.addEventListener('click', () => handleSubmitPayment('Cash'));
    // if (payChequeBtn) payChequeBtn.addEventListener('click', () => handleSubmitPayment('Cheque'));
    // if (payEftposBtn) payEftposBtn.addEventListener('click', () => handleSubmitPayment('EFTPOS'));
    if (invoiceRemainingButton) invoiceRemainingButton.addEventListener('click', handleInvoiceAndKeepOpen);

    // Event delegation for cart item actions
    if (cartItemsDiv) {
        cartItemsDiv.addEventListener('click', async (event) => {
            if (event.target.classList.contains('remove-from-cart-btn')) {
                const saleItemId = event.target.dataset.saleItemId;
                await handleRemoveItemFromCart(saleItemId);
            }
            if (event.target.classList.contains('edit-cart-item-btn')) {
                const saleItemId = event.target.dataset.saleItemId;
                const itemName = event.target.dataset.itemName;
                const priceAtSale = parseFloat(event.target.dataset.priceAtSale);
                const currentNotes = event.target.dataset.currentNotes;

                if (isNaN(priceAtSale)) {
                    showToast('Error: Item price is invalid. Cannot edit.', 'error');
                    console.error('Invalid priceAtSale for edit-cart-item-btn:', event.target.dataset.priceAtSale);
                    return;
                }

                // The modal expects: openEditSaleItemModal(saleItemId, originalPrice (which is priceAtSale here), currentSalePrice (initially same), currentNotes, itemName)
                openEditSaleItemModal(saleItemId, priceAtSale, priceAtSale, currentNotes, itemName);
            }
        });

        cartItemsDiv.addEventListener('change', async (event) => {
            if (event.target.classList.contains('cart-item-quantity-input')) {
                const saleItemId = event.target.dataset.saleItemId;
                const newQuantity = parseInt(event.target.value);
                await handleUpdateCartItemQuantity(saleItemId, newQuantity);
            }
        });
    }

    // Quick Add Dashboard Listeners
    if (quickAddEditModeBtn) {
        quickAddEditModeBtn.addEventListener('click', toggleQuickAddEditMode);
    }
    if (quickAddNewItemBtn) {
        quickAddNewItemBtn.addEventListener('click', openQuickAddNewItemModal);
    }
    if (quickAddNewPageLinkBtn) {
        quickAddNewPageLinkBtn.addEventListener('click', openQuickAddNewPageLinkModal);
    }

    // Quick Add Modals
    if (closeQuickAddNewItemModalBtn) {
        closeQuickAddNewItemModalBtn.addEventListener('click', closeQuickAddNewItemModal);
    }
    if (qaiItemSearchButton) {
        qaiItemSearchButton.addEventListener('click', handleSearchQAIItems);
        qaiItemSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearchQAIItems(); });
    }
    if (qaiItemSearchResultsDiv) {
         qaiItemSearchResultsDiv.addEventListener('click', async (event) => {
            const target = event.target.closest('.item-search-result-for-quickadd');
            if (target) {
                const itemId = target.dataset.itemId;
                const itemTitle = target.dataset.itemTitle;
                await handleAddQuickAddItem(itemId, itemTitle);
                closeQuickAddNewItemModal();
            }
        });
    }

    if (closeQuickAddNewPageLinkModalBtn) {
        closeQuickAddNewPageLinkModalBtn.addEventListener('click', closeQuickAddNewPageLinkModal);
    }
    if (qaiSubmitNewPageLinkButton) {
        qaiSubmitNewPageLinkButton.addEventListener('click', handleAddQuickAddPageLink);
    }

    if (quickAddGridContainer) {
        quickAddGridContainer.addEventListener('dragstart', (e) => {
            const itemDiv = e.target.closest('.quick-add-item.editable:not(.is-back-button)');
            if(itemDiv) {
                const qaiId = itemDiv.dataset.qaiId;
                const qaiData = state.quickAddItemsCache.find(item => item.id && item.id.toString() === qaiId);
                if(qaiData) handleQAIDragStart(e, itemDiv, qaiData);
            }
        });
        quickAddGridContainer.addEventListener('dragend', handleQAIDragEnd);
        quickAddGridContainer.addEventListener('dragover', handleQAIDragOver);
        quickAddGridContainer.addEventListener('drop', (e) => {
            const targetElement = e.target.closest('.quick-add-item');
            handleQAIDrop(e, targetElement);
        });
        quickAddGridContainer.addEventListener('click', (event) => {
            const deleteButton = event.target.closest('.delete-qai-btn');
            if (deleteButton && state.isQuickAddEditMode) {
                const itemDiv = deleteButton.closest('.quick-add-item');
                const qaiId = itemDiv.dataset.qaiId;
                const qaiLabel = itemDiv.querySelector('.quick-add-item-image-label')?.textContent || itemDiv.textContent || 'this item';
                handleDeleteQuickAddItem(qaiId, qaiLabel);
            }
        });
    }
    
    // Panel interaction listeners
    if (leftPanelExpandTag) {
        leftPanelExpandTag.addEventListener('click', expandLeftPanel);
    }

    // --- Initial Load ---
    loadParkedSales();
    serviceLoadAndDisplayCustomers(); // Initial load of customers using the service
    updateCartDisplay(); // Initial cart display and panel state setup
    loadQuickAddItems(state.currentQuickAddPage);


    // Event Listeners for Customer Management Section
    if (customerMgmtAddNewButton) {
        customerMgmtAddNewButton.addEventListener('click', serviceOpenAddCustomerModal);
    }
    if (closeEditCustomerModalButton) {
        closeEditCustomerModalButton.addEventListener('click', serviceCloseEditCustomerModal);
    }
    if (submitUpdateCustomerButton) {
        submitUpdateCustomerButton.addEventListener('click', serviceHandleUpdateCustomer);
    }
    if (customerMgmtSearchInput) {
        customerMgmtSearchInput.addEventListener('input', serviceLoadAndDisplayCustomers); // Re-filter on input
    }

    let currentQuickAddPage = 1;
    let isQuickAddEditMode = false;
    let draggedQAI = null; // To store the element being dragged
    let quickAddItemsCache = []; // Cache for currently loaded quick add items

}); 