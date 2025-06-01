// Basic POS System - app.js
import { apiCall } from './apiService.js';
import { showToast } from './toastService.js';
import { state } from './uiState.js'; 
import {
    createNewSale, 
    addItemToCart,
    loadSaleIntoCart,
    updateCartCustomerDisplay, 
    updateCartDisplay, 
    handleUpdateCartItemQuantity,
    handleRemoveItemFromCart,
} from './cart.js';
import {
    shrinkLeftPanel,
    expandLeftPanel,
    collapseParkedSales,
    expandParkedSales,
    expandItemSearchResults,
    collapseItemSearchResults,
    collapseQuickAddDashboard,
    expandQuickAddDashboard,
    toggleLeftPanelSection
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
    initItemService,
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
    handleItemClick as serviceHandleItemClick
} from './itemService.js';


document.addEventListener('DOMContentLoaded', () => {
    console.log("POS App Loaded");

    initCustomerService(updateCartDisplay, createNewSale, updateCartCustomerDisplay);
    initItemService();

    console.log("Item Service Initialized");

    // Left Panel Sections for dynamic sizing
    const customerManagementSection = document.getElementById('customer-management-section');
    const allSalesSearchSection = document.getElementById('all-sales-search-section');
    const customerManagementTitle = customerManagementSection?.querySelector('.left-panel-section-title');
    const allSalesSearchTitle = allSalesSearchSection?.querySelector('.left-panel-section-title');

    // DEBUGGING LOGS START
    console.log('DEBUG: customerManagementSection:', customerManagementSection);
    console.log('DEBUG: allSalesSearchSection:', allSalesSearchSection);
    console.log('DEBUG: customerManagementTitle:', customerManagementTitle);
    console.log('DEBUG: allSalesSearchTitle:', allSalesSearchTitle);
    // DEBUGGING LOGS END

    // --- UI Element Selectors (Reduced set for app.js) ---
    const itemSearchButton = document.getElementById('item-search-button');
    const itemClearSearchButton = document.getElementById('item-clear-search-button');
    const itemSearchInput = document.getElementById('item-search-input'); // For keyup listener
    
    const leftPanelExpandTag = document.getElementById('left-panel-expand-tag');

    const parkSaleButton = document.getElementById('park-sale-button');
    const finalizeSaleButton = document.getElementById('finalize-sale-button');
    const setQuoteStatusButton = document.getElementById('set-quote-status-button');
    const voidSaleButton = document.getElementById('void-sale-button');
    const parkedSalesListDiv = document.getElementById('parked-sales-list');

    const paymentModal = document.getElementById('paymentModal');
    const paymentModalSaleIdInput = document.getElementById('paymentModalSaleId');
    const paymentAmountInput = document.getElementById('paymentAmount');
    const invoiceRemainingButton = document.getElementById('invoiceRemainingButton');
    const payCashButton = document.getElementById('payCashButton');
    const payChequeButton = document.getElementById('payChequeButton');
    const payEftposButton = document.getElementById('payEftposButton');

    const addCustomerModal = document.getElementById('customerModal'); // For window click
    const editCustomerModal = document.getElementById('edit-customer-modal'); // For window click
    const closeAddCustomerModalButton = document.getElementById('close-add-customer-modal');
    const submitNewCustomerButton = document.getElementById('submit-new-customer-button');
    const submitNewCustomerAndAddToSaleButton = document.getElementById('submit-new-customer-and-add-to-sale-button');
    const customerMgmtSearchInput = document.getElementById('customer-mgmt-search-input');
    const customerMgmtAddNewButton = document.getElementById('customer-mgmt-add-new-button');
    const closeEditCustomerModalButton = document.getElementById('close-edit-customer-modal');
    const submitUpdateCustomerButton = document.getElementById('submit-update-customer-button');

    const searchSaleIdInput = document.getElementById('search-sale-id');
    const searchSaleCustomerInput = document.getElementById('search-sale-customer');
    const searchSaleStatusSelect = document.getElementById('search-sale-status');
    const searchSalesButton = document.getElementById('search-sales-button');
    const allSalesSearchResultsDiv = document.getElementById('all-sales-search-results');

    // Item Modals (for window click and some direct button listeners)
    const variantSelectionModal = document.getElementById('variant-selection-modal'); // For window click
    const imagePreviewModal = document.getElementById('imagePreviewModal'); // For window click
    const addEditItemModal = document.getElementById('add-edit-item-modal');  // For window click
    const openAddItemModalButton = document.getElementById('open-add-item-modal-button');
    const closeAddEditItemModalButton = document.getElementById('close-add-edit-item-modal');
    const submitItemButton = document.getElementById('submit-item-button');
    const submitItemAndAddToCartButton = document.getElementById('submit-item-and-add-to-cart-button');
    const manageVariantsButton = document.getElementById('manage-variants-button');
    const itemImagesListDiv = document.getElementById('item-images-list'); // For delegated delete image listener
    const itemImagesUploadInput = document.getElementById('item-images-upload'); // For change listener (now handled by itemService.setupItemImageDropZone)
    const closeVariantSelectionModalButton = document.getElementById('close-variant-selection-modal');
    const closeImagePreviewModalButton = document.getElementById('closeImagePreviewModal');


    // Quick Add Dashboard UI Elements (mostly unchanged, listeners remain here)
    const quickAddGridContainer = document.getElementById('quick-add-grid-container');
    const quickAddCurrentPageSpan = document.getElementById('quick-add-current-page');
    const quickAddPageInfoDiv = document.getElementById('quick-add-page-info');
    const quickAddEditModeBtn = document.getElementById('quick-add-edit-mode-btn');
    const quickAddControlsDiv = document.getElementById('quick-add-controls');
    const quickAddNewItemBtn = document.getElementById('quick-add-new-item-btn');
    const quickAddNewPageLinkBtn = document.getElementById('quick-add-new-page-link-btn');
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

    const editSaleItemModal = document.getElementById('editSaleItemModal');
    const editSaleItemId = document.getElementById('editSaleItemId'); // Hidden input for sale_item_id
    const editSaleItemOriginalPriceHidden = document.getElementById('editSaleItemOriginalPrice'); // Hidden input for original price
    const editSaleItemName = document.getElementById('editSaleItemName');
    const editSaleItemOriginalPriceDisplay = document.getElementById('editSaleItemOriginalPriceDisplay');
    const itemDiscountPercent = document.getElementById('itemDiscountPercent');
    const itemDiscountAbsolute = document.getElementById('itemDiscountAbsolute');
    const itemFinalPrice = document.getElementById('itemFinalPrice');
    const itemNotes = document.getElementById('itemNotes');
   
    const itemDiscountPercentInput = document.getElementById('itemDiscountPercent');
    const itemDiscountAbsoluteInput = document.getElementById('itemDiscountAbsolute');
    const cartItemsDiv = document.getElementById('cart-items');

    // Print Options Modal Elements
    const printOptionsModal = document.getElementById('print-options-modal');
    const closePrintOptionsModalButton = document.getElementById('close-print-options-modal');
    const printOptionsModalTitle = document.getElementById('print-options-modal-title');
    const printOptionsSaleIdInput = document.getElementById('print-options-sale-id');
    const printInvoiceA4Btn = document.getElementById('print-invoice-a4-btn');
    const printInvoiceReceiptBtn = document.getElementById('print-invoice-receipt-btn');
    const printQuoteA4Btn = document.getElementById('print-quote-a4-btn');
    const printQuoteReceiptBtn = document.getElementById('print-quote-receipt-btn');

    // --- Initial Load Functions ---
    async function loadParkedSales() {
        parkedSalesListDiv.innerHTML = '<p>Loading parked sales...</p>';
        const sales = await apiCall('/sales/status/Open');
        console.log("Fetched parked sales:", sales); 
        parkedSalesListDiv.innerHTML = ''; 
        if (sales && sales.length > 0) {
            sales.forEach(sale => {
                const saleDiv = document.createElement('div');
                saleDiv.className = 'parked-sale-entry'; // Add a class for styling and selection
                const totalDisplay = sale.sale_total !== undefined && sale.sale_total !== null ? sale.sale_total.toFixed(2) : '0.00';
                saleDiv.innerHTML = `Sale ID: ${sale.id} - Customer: ${sale.customer ? sale.customer.name : 'N/A'} - Total: ${totalDisplay}`;
                saleDiv.style.cursor = 'pointer';
                saleDiv.style.padding = '5px';
                saleDiv.style.borderBottom = '1px solid #eee';
                saleDiv.onclick = () => {
                    // Visual feedback for selection
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
        updateCartDisplay(); 
    }
    
    // --- Finalize and Pay --- 
    async function handleFinalizeAndPay() {
        console.log("handleFinalizeAndPay called. currentSale:", state.currentSale, "currentCustomer:", state.currentCustomer);
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

    function openPaymentModal(sale) {
        if (!paymentModalSaleIdInput || !paymentAmountInput || !paymentModal || !invoiceRemainingButton) return;
        paymentModalSaleIdInput.value = sale.id;
        paymentAmountInput.value = sale.amount_due.toFixed(2);
        paymentModal.style.display = 'block';
        if (sale.status === 'Open' || sale.status === 'Quote') {
            invoiceRemainingButton.style.display = 'inline-block';
        } else {
            invoiceRemainingButton.style.display = 'none';
        }
    }

    window.closePaymentModal = function() {
        if (paymentModal) {
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
            updateCartDisplay();
            loadParkedSales();
            closePaymentModal();
        } else {
            showToast("Failed to update sale to Invoice status.", 'error');
        }
    }

    async function handleSubmitPayment(paymentType) { 
        const callId = Date.now();
        console.log(`[${callId}] handleSubmitPayment CALLED with type: ${paymentType}, currentSale status: ${state.currentSale ? state.currentSale.status : 'N/A'}`);
        if (!state.currentSale || !state.currentSale.id) {
            showToast("No active sale to process payment for.", "error");
            console.log(`[${callId}] Aborting: No state.currentSale or state.currentSale.id`);
            return;
        }
        if (state.currentSale.status === 'Paid') {
            showToast("This sale is already marked as Paid.", "info");
            console.log(`[${callId}] Aborting: Sale already Paid.`);
            return; 
        }
        const amountText = paymentAmountInput.value;
        const amount = parseFloat(amountText);
        if (isNaN(amount) || amount <= 0) {
            showToast("Invalid payment amount.", "error");
            if (paymentAmountInput) paymentAmountInput.focus();
            console.log(`[${callId}] Aborting: Invalid payment amount.`);
            return;
        }
        if (state.currentSale.status === 'Open' || state.currentSale.status === 'Quote') {
            console.log(`[${callId}] Updating sale status to Invoice...`);
            const statusUpdate = await apiCall(`/sales/${state.currentSale.id}/status`, 'PUT', { status: 'Invoice' });
            if (statusUpdate && statusUpdate.id) {
                state.currentSale = statusUpdate;
                updateCartDisplay();
                showToast(`Sale status updated to ${state.currentSale.status}.`, "info");
                console.log(`[${callId}] Sale status updated to: ${state.currentSale.status}`);
            } else {
                showToast("Failed to update sale status to Invoice before payment. Aborting payment.", "error");
                console.log(`[${callId}] Aborting: Failed to update status to Invoice.`);
                return;
            }
        }
        if (state.currentSale.status === 'Paid') {
            showToast("Sale became Paid during status update. No further payment needed.", "info");
            console.log(`[${callId}] Aborting: Sale became Paid during status update phase.`);
            return;
        }
        console.log(`[${callId}] Proceeding to record payment. Sale status: ${state.currentSale.status}`);
        const paymentData = { amount: amount, payment_type: paymentType };
        const paymentResult = await apiCall(`/sales/${state.currentSale.id}/payments`, 'POST', paymentData);
        if (paymentResult && paymentResult.id) {
            state.currentSale = paymentResult;
            console.log(`[${callId}] Payment recorded. New sale status: ${state.currentSale.status}`);
            showToast(`Payment of $${amount.toFixed(2)} via ${paymentType} recorded successfully.`, "success");
            updateCartDisplay(); 
            closePaymentModal();
            if (state.currentSale.status === 'Paid') {
                console.log(`[${callId}] Sale is now PAID. Setting timeout to clear cart.`);
                showToast(`Sale ${state.currentSale.id} is now fully Paid. Clearing cart.`, "info");
                setTimeout(() => {
                    console.log(`[${callId}] Timeout: Clearing cart for sale ID ${state.currentSale ? state.currentSale.id : 'N/A'} which was PAID.`);
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
            showToast("Failed to record payment or received invalid response.", "error");
            console.log(`[${callId}] Payment recording failed or invalid response. paymentResult:`, paymentResult);
        }
    }

    async function parkCurrentSale() {
        if (state.currentSale && state.currentSale.id) {
            let saleToParkStatus = state.currentSale.status;
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

    async function handleSetQuoteStatus() {
        if (!state.currentSale || !state.currentSale.id) {
            showToast("No active sale to set as quote.", 'warning');
            return;
        }
        if (state.currentSale.status !== 'Open' && state.currentSale.status !== 'Invoice') {
            showToast(`Sale status is ${state.currentSale.status}. Only 'Open' or 'Invoice' sales can be set to 'Quote'.`, 'warning');
            return;
        }
        const updatedSale = await apiCall(`/sales/${state.currentSale.id}/status`, 'PUT', { status: 'Quote' });
        if (updatedSale && updatedSale.id) {
            state.currentSale = updatedSale;
            showToast(`Sale ${state.currentSale.id} is now a Quote.`, 'success');
            updateCartDisplay();
            loadParkedSales();
        } else {
            showToast("Failed to update sale to Quote status.", 'error');
        }
    }

    async function handleVoidSale() {
        if (!state.currentSale || !state.currentSale.id) {
            showToast("No active sale to void.", 'warning');
            return;
        }

        if (state.currentSale.status === 'Paid' || state.currentSale.status === 'Void') {
            showToast(`Sale is already ${state.currentSale.status}. Cannot void.`, 'info');
            return;
        }

        // Optional: Add a confirmation dialog in a real application
        // const confirmed = confirm(`Are you sure you want to void sale ${state.currentSale.id}? This action cannot be undone.`);
        // if (!confirmed) return;

        const updatedSale = await apiCall(`/sales/${state.currentSale.id}/status`, 'PUT', { status: 'Void' });
        if (updatedSale && updatedSale.id) {
            state.currentSale = updatedSale; // Keep it in state to show it's voided
            showToast(`Sale ${state.currentSale.id} has been voided.`, 'success');
            updateCartDisplay(); // Update display to reflect void status
            loadParkedSales();   // Refresh parked sales list

            // Optionally, clear after a delay
            setTimeout(() => {
                if (state.currentSale && state.currentSale.id === updatedSale.id && state.currentSale.status === 'Void') {
                    state.currentSale = null;
                    state.currentCustomer = null;
                    updateCartDisplay();
                    console.log(`Cleared voided sale ${updatedSale.id} from active cart view.`);
                }
            }, 2000);
        } else {
            showToast("Failed to void sale.", 'error');
        }
    }

    async function searchAllSales() {
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

        const sales = await apiCall('/sales/', 'GET', null, queryParams);

        allSalesSearchResultsDiv.innerHTML = ''; // Clear loading/previous results
        if (sales && sales.length > 0) {
            sales.forEach(sale => {
                const saleDiv = document.createElement('div');
                saleDiv.className = 'sale-search-result-item';
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
                    <button class="view-sale-details-btn btn btn-info" data-sale-id="${sale.id}">View/Load</button>
                    <button class="print-email-sale-btn btn btn-success" data-sale-id="${sale.id}">Print / Email</button>
                `;
                const viewButton = saleDiv.querySelector('.view-sale-details-btn');
                if (viewButton) {
                    viewButton.addEventListener('click', () => {
                        loadSaleIntoCart(sale.id);
                        showToast(`Sale ${sale.id} loaded into cart.`, 'success');
                    });
                }
                const printEmailButton = saleDiv.querySelector('.print-email-sale-btn');
                if (printEmailButton) {
                    printEmailButton.addEventListener('click', () => {
                        // Store the sale data if needed, or just the ID
                        // For now, just pass the sale ID to a new function that will open the modal
                        openPrintOptionsModal(sale.id); 
                    });
                }
                allSalesSearchResultsDiv.appendChild(saleDiv);
            });
        } else if (sales) { 
            allSalesSearchResultsDiv.innerHTML = '<p>No sales found matching your criteria.</p>';
        } else { 
            allSalesSearchResultsDiv.innerHTML = '<p>Error searching sales. Please try again.</p>';
        }
    }

    // --- Quick Add Dashboard Functions (Remain in app.js for now) ---
    function toggleQuickAddEditMode() {
        state.isQuickAddEditMode = !state.isQuickAddEditMode;
        if (quickAddEditModeBtn) {
            quickAddEditModeBtn.classList.toggle('active', state.isQuickAddEditMode);
            quickAddEditModeBtn.innerHTML = state.isQuickAddEditMode ? '&#128736;' : '&#9998;'; 
        }
        if (quickAddControlsDiv) {
            quickAddControlsDiv.style.display = state.isQuickAddEditMode ? 'block' : 'none';
        }
        loadQuickAddItems(state.currentQuickAddPage); 
    }

    async function loadQuickAddItems(pageNumber) {
        if (!quickAddGridContainer || !quickAddCurrentPageSpan) return;

        state.currentQuickAddPage = pageNumber;
        quickAddCurrentPageSpan.textContent = pageNumber;
        quickAddGridContainer.innerHTML = '<p>Loading quick items...</p>';
        quickAddGridContainer.classList.toggle('edit-mode', state.isQuickAddEditMode);

        state.quickAddItemsCache = []; 
        const fetchedQuickItems = await apiCall('/quick_add_items/', 'GET', null, { page: pageNumber });
        
        quickAddGridContainer.innerHTML = ''; 
        
        let finalItemsToRender = [];
        if (fetchedQuickItems && Array.isArray(fetchedQuickItems)) {
            state.quickAddItemsCache = [...fetchedQuickItems]; 
            finalItemsToRender = [...fetchedQuickItems];
        } else if (fetchedQuickItems && typeof fetchedQuickItems === 'object' && fetchedQuickItems !== null && fetchedQuickItems.id !== undefined) {
            console.warn("API returned a single object for quick items, wrapping in array:", fetchedQuickItems);
            state.quickAddItemsCache = [fetchedQuickItems];
            finalItemsToRender = [fetchedQuickItems];
        } else if (fetchedQuickItems === null || (Array.isArray(fetchedQuickItems) && fetchedQuickItems.length === 0) ) {
            // No items or null response
        }
        else if (!fetchedQuickItems) { 
             quickAddGridContainer.innerHTML = '<p>Error loading quick add items.</p>';
        }

        if (pageNumber > 1) {
            const backButtonData = {
                id: 'internal-back-btn', 
                type: 'page_link',
                label: '< Back',
                target_page_number: 1, 
                color: '#dddddd', 
                is_back_button: true 
            };
            finalItemsToRender.unshift(backButtonData); 
        }

        if (finalItemsToRender.length > 0) {
            finalItemsToRender.forEach(qItem => {
                const itemDiv = createQuickAddItemElement(qItem);
                quickAddGridContainer.appendChild(itemDiv);
            });
        } else if (pageNumber === 1) { 
            if(state.quickAddItemsCache.length === 0 && !quickAddGridContainer.textContent.includes("Error loading")) {
                 quickAddGridContainer.innerHTML = '<p>No quick add items configured for this page.</p>';
            }
        } 

        if (quickAddPageInfoDiv) {
            quickAddPageInfoDiv.style.display = pageNumber > 1 ? 'block' : 'none';
        }
    }

    function createQuickAddItemElement(qItem) {
        const itemDiv = document.createElement('div');
        itemDiv.className = `quick-add-item type-${qItem.type}`;
        itemDiv.dataset.qaiId = qItem.id; 

        if (qItem.type === 'item' && qItem.primary_photo_small_url) {
            itemDiv.style.backgroundImage = `url('${qItem.primary_photo_small_url}')`;
            itemDiv.classList.add('has-image');
            const labelSpan = document.createElement('span');
            labelSpan.className = 'quick-add-item-image-label';
            labelSpan.textContent = qItem.label;
            itemDiv.appendChild(labelSpan);
        } else {
            itemDiv.textContent = qItem.label;
        }

        if (qItem.color && !(qItem.type === 'item' && qItem.primary_photo_small_url)) {
            itemDiv.style.backgroundColor = qItem.color;
        }

        const itemClickHandler = () => {
            if (qItem.type === 'item') {
                if (qItem.item_id) {
                    if (qItem.item_parent_id === -2) {
                        // It's a parent item, trigger variant selection
                        // serviceHandleItemClick expects: itemId, itemTitle, itemPrice, itemSku, parentId
                        // For a parent item, price might be 0 or null. Pass it as is.
                        // The itemTitle is qItem.label. itemSku is qItem.item_sku
                        serviceHandleItemClick(qItem.item_id, qItem.label, qItem.item_price, qItem.item_sku, qItem.item_parent_id);
                    } else {
                        // Not a parent, or simple item. Add directly to cart.
                        // Ensure price is valid before adding to cart.
                        if (qItem.item_price !== null && qItem.item_price !== undefined) {
                            addItemToCart(qItem.item_id, qItem.item_price); // Corrected: only itemId and price
                            showToast(`${qItem.label} added to cart.`, 'success');
                        } else {
                            console.error('Quick add item is missing price:', qItem);
                            showToast(`Price missing for ${qItem.label}. Cannot add to cart.`, 'error');
                        }
                    }
                } else {
                    console.error('Quick add item is missing item_id:', qItem);
                    showToast(`Data missing for ${qItem.label}. Cannot process.`, 'error');
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
            deleteBtn.innerHTML = '&times;'; 
            deleteBtn.title = 'Delete this item';
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); 
                handleDeleteQuickAddItem(qItem.id, qItem.label);
            };
            itemDiv.appendChild(deleteBtn);
        } else {
            itemDiv.addEventListener('click', itemClickHandler);
            if (qItem.is_back_button) {
                 itemDiv.classList.add('is-back-button'); 
            }
        }
        
        itemDiv.addEventListener('dragover', handleQAIDragOver);
        itemDiv.addEventListener('drop', (e) => handleQAIDrop(e, itemDiv));

        return itemDiv;
    }
    
    function openQuickAddNewItemModal() { 
        if (quickAddNewItemModal) {
            // Clear previous search results and input
            if (qaiItemSearchInput) qaiItemSearchInput.value = '';
            if (qaiItemSearchResultsDiv) qaiItemSearchResultsDiv.innerHTML = '<p>Enter search term to find items.</p>';
            quickAddNewItemModal.style.display = 'block';
        } else {
            console.error("quickAddNewItemModal element not found!");
            showToast("Error: Quick Add Item modal is not available.", "error");
        }
    }
    function closeQuickAddNewItemModal() { 
        if (quickAddNewItemModal) {
            quickAddNewItemModal.style.display = 'none';
        }
    }
    function openQuickAddNewPageLinkModal() { 
        if (quickAddNewPageLinkModal) {
            // Clear previous inputs
            if (qaiPageLinkLabelInput) qaiPageLinkLabelInput.value = '';
            if (qaiPageLinkTargetInput) qaiPageLinkTargetInput.value = '';
            if (qaiPageLinkColorInput) qaiPageLinkColorInput.value = '#A0E7E5'; // Reset to default
            quickAddNewPageLinkModal.style.display = 'block';
        } else {
            console.error("quickAddNewPageLinkModal element not found!");
            showToast("Error: Quick Add Page Link modal is not available.", "error");
        }
    }
    function closeQuickAddNewPageLinkModal() { 
        if (quickAddNewPageLinkModal) {
            quickAddNewPageLinkModal.style.display = 'none';
        }
    }
    async function handleSearchQAIItems() { 
        if (!qaiItemSearchInput || !qaiItemSearchResultsDiv) {
            console.error("QAI Item search elements not found");
            showToast("Error: Search elements in modal missing.", "error");
            return;
        }
        const searchTerm = qaiItemSearchInput.value.trim();
        if (!searchTerm) {
            qaiItemSearchResultsDiv.innerHTML = '<p>Please enter a search term (SKU or Title).</p>';
            return;
        }

        qaiItemSearchResultsDiv.innerHTML = '<p>Searching items...</p>';

        try {
            // Use the existing item search endpoint if suitable, or a dedicated one if available
            // Assuming the main item search can be filtered and is light enough for this
            const queryParams = { q: searchTerm, limit: 20 }; // Limit results for modal display
            const items = await apiCall('/items/', 'GET', null, queryParams);

            qaiItemSearchResultsDiv.innerHTML = ''; // Clear loading message

            if (items && items.length > 0) {
                items.forEach(item => {
                    if (!item.is_current_version) return; // Only show current versions

                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'qai-search-result';
                    itemDiv.textContent = `${item.title} (SKU: ${item.sku}) - Price: ${item.price !== null ? item.price.toFixed(2) : 'N/A'}`;
                    itemDiv.dataset.itemId = item.id;
                    itemDiv.dataset.itemTitle = item.title;
                    itemDiv.dataset.itemPrice = item.price; // Store price
                    itemDiv.dataset.itemParentId = item.parent_id; // Store parent_id
                    
                    // Add click listener to select the item
                    itemDiv.addEventListener('click', () => {
                        // Remove 'selected' class from previously selected item
                        const currentlySelected = qaiItemSearchResultsDiv.querySelector('.qai-search-result.selected');
                        if (currentlySelected) {
                            currentlySelected.classList.remove('selected');
                        }
                        // Add 'selected' class to clicked item
                        itemDiv.classList.add('selected');
                    });
                    qaiItemSearchResultsDiv.appendChild(itemDiv);
                });
            } else {
                qaiItemSearchResultsDiv.innerHTML = '<p>No items found matching your search.</p>';
            }
        } catch (error) {
            console.error('Error searching items for QAI modal:', error);
            qaiItemSearchResultsDiv.innerHTML = '<p>Error fetching items. Please try again.</p>';
            showToast("Error searching items. See console.", "error");
        }
    }
    
    // Modified to accept parameters and contain the logic for adding a QAI item
    async function handleAddQuickAddItem(itemId, itemTitle, itemPrice, itemParentId) { 
        // If it's a parent item (parent_id == -2), price might be irrelevant or 0.
        // The original price check might be too strict for parent items.
        // For now, we'll keep the check but acknowledge it might need refinement if parent items legitimately have null/0 price.
        if (itemParentId !== '-2' && (itemPrice === null || itemPrice === undefined || itemPrice === "null" || itemPrice === "undefined")) {
            showToast('Selected item does not have a valid price. Cannot add to Quick Add.', 'error');
            return;
        }
        
        const numericItemPrice = parseFloat(itemPrice);
        if (itemParentId !== '-2' && isNaN(numericItemPrice)) {
             showToast('Selected item price is not a valid number. Cannot add to Quick Add.', 'error');
            return;
        }

        const newQaiData = {
            page_number: state.currentQuickAddPage,
            type: 'item',
            label: itemTitle.substring(0, 50), // Max label length
            item_id: itemId,
            item_parent_id: itemParentId ? parseInt(itemParentId, 10) : null, // Add item_parent_id
            color: '#B4F8C8' // Default color for new items
        };
        const result = await apiCall('/quick_add_items/', 'POST', newQaiData);
        if (result && !result.error) {
            showToast(`'${itemTitle}' added to Quick Add page ${state.currentQuickAddPage}.`, 'success');
            closeQuickAddNewItemModal();
            loadQuickAddItems(state.currentQuickAddPage);
        } else {
            showToast(`Failed to add item to Quick Add: ${result ? result.error : 'Unknown error'}`, 'error');
        }
    }

    async function handleAddQuickAddPageLink() { 
        if (!qaiPageLinkLabelInput || !qaiPageLinkTargetInput || !qaiPageLinkColorInput) {
            showToast("Page link modal form elements are missing.", "error");
            return;
        }
        const label = qaiPageLinkLabelInput.value.trim();
        const targetPage = parseInt(qaiPageLinkTargetInput.value, 10);
        const color = qaiPageLinkColorInput.value;

        if (!label) {
            showToast("Button label is required for a page link.", "warning");
            qaiPageLinkLabelInput.focus();
            return;
        }
        if (isNaN(targetPage) || targetPage <= 0) {
            showToast("Valid target page number is required.", "warning");
            qaiPageLinkTargetInput.focus();
            return;
        }

        const newPageLinkData = {
            page_number: state.currentQuickAddPage, // The page this link will appear on
            type: 'page_link',
            label: label,
            target_page_number: targetPage,
            color: color,
            // position will be handled by backend or set to default (e.g., end of list)
        };

        try {
            showToast('Adding page link...', 'info');
            const result = await apiCall('/quick_add_items/', 'POST', newPageLinkData);
            if (result && result.id) {
                showToast(`Page link "${label}" added to Quick Add page ${state.currentQuickAddPage}.`, 'success');
                closeQuickAddNewPageLinkModal();
                loadQuickAddItems(state.currentQuickAddPage);
            } else {
                showToast(`Failed to add page link: ${result ? result.error : 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Error adding Quick Add page link:', error);
            showToast(`Error adding page link: ${error.message || 'Unknown error'}. See console.`, 'error');
        }
    }
    async function handleDeleteQuickAddItem(qaiId, qaiLabel) { 
        if (!qaiId) {
            showToast("Cannot delete: Quick Add Item ID is missing.", "error");
            return;
        }

        const confirmed = confirm(`Are you sure you want to delete the Quick Add item "${qaiLabel || 'this item'}"?`);
        if (!confirmed) return;

        try {
            showToast(`Deleting "${qaiLabel || 'item'}"...`, 'info');
            // API endpoint for deleting a quick_add_item might be /quick_add_items/<id>
            const result = await apiCall(`/quick_add_items/${qaiId}`, 'DELETE');

            // The API might return nothing on successful DELETE, or a confirmation message.
            // We'll assume success if no error is thrown and then reload the items.
            // If result has an error property, it means the apiCall wrapper caught an issue.
            if (result && result.error) {
                 showToast(`Failed to delete Quick Add item: ${result.error}`, 'error');
            } else if (result && result.message) { // Some APIs might return a success message
                showToast(result.message, 'success');
                loadQuickAddItems(state.currentQuickAddPage); // Reload the quick add items for the current page
            } else {
                showToast(`"${qaiLabel || 'Item'}" deleted from Quick Add.`, 'success');
                loadQuickAddItems(state.currentQuickAddPage); // Reload the quick add items for the current page
            }
        } catch (error) {
            console.error('Error deleting Quick Add item:', error);
            showToast(`Error deleting Quick Add item: ${error.message || 'Unknown error'}. See console.`, 'error');
        }
    }
    function handleQAIDragStart(e, itemDiv, qaiData) { 
        if (!state.isQuickAddEditMode || (qaiData && qaiData.is_back_button)) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('text/plain', qaiData.id); // Store the ID of the dragged item
        e.dataTransfer.effectAllowed = 'move';
        if (itemDiv) {
            itemDiv.classList.add('dragging');
        }
        state.draggedQAI = qaiData; // Store the whole data object if needed for drop
    }
    function handleQAIDragEnd(e) { 
        const draggingElement = document.querySelector('.quick-add-item.dragging');
        if (draggingElement) {
            draggingElement.classList.remove('dragging');
        }
        // Clear any visual cues for drop targets if necessary
        const dropTargets = document.querySelectorAll('.qai-drop-target-active');
        dropTargets.forEach(dt => dt.classList.remove('qai-drop-target-active'));
        state.draggedQAI = null;
    }
    function handleQAIDragOver(e) { 
        if (!state.isQuickAddEditMode) return;
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';

        // Optional: Add visual indicator for drop target
        const targetItem = e.target.closest('.quick-add-item:not(.is-back-button)');
        const container = e.target.closest('#quick-add-grid-container');

        // Remove previous indicators
        const currentActiveDropTargets = document.querySelectorAll('.qai-drop-target-active');
        currentActiveDropTargets.forEach(dt => dt.classList.remove('qai-drop-target-active'));

        if (targetItem && targetItem !== document.querySelector('.quick-add-item.dragging')) {
            targetItem.classList.add('qai-drop-target-active');
        } else if (container && !targetItem && !document.querySelector('.quick-add-item.dragging')){
            // No specific item, could be dropping at end of container
            // For simplicity, we might not add a visual for this case or handle it in drop directly
        }
    }
    async function handleQAIDrop(e, targetElement) { 
        if (!state.isQuickAddEditMode || !state.draggedQAI) return;
        e.preventDefault();

        const draggedItemId = state.draggedQAI.id;
        let targetItemId = null;
        let dropAtEnd = false;

        const currentDraggingElement = document.querySelector('.quick-add-item.dragging');
        if (currentDraggingElement) currentDraggingElement.classList.remove('dragging');
        const dropTargets = document.querySelectorAll('.qai-drop-target-active');
        dropTargets.forEach(dt => dt.classList.remove('qai-drop-target-active'));

        if (targetElement && targetElement.classList.contains('quick-add-item') && !targetElement.classList.contains('is-back-button')) {
            targetItemId = targetElement.dataset.qaiId;
        } else if (targetElement === quickAddGridContainer) {
            dropAtEnd = true;
        }

        if (draggedItemId === targetItemId) { // Dropped on itself
            state.draggedQAI = null;
            return;
        }

        // Create the ordered list of item IDs for the current page
        const currentPageItems = Array.from(quickAddGridContainer.querySelectorAll('.quick-add-item:not(.is-back-button)'))
                                   .map(div => div.dataset.qaiId);
        
        const draggedItemIndex = currentPageItems.indexOf(draggedItemId.toString());
        if (draggedItemIndex === -1) {
            console.error("Dragged item not found in current page list.");
            state.draggedQAI = null;
            return;
        }

        // Remove dragged item from its old position
        currentPageItems.splice(draggedItemIndex, 1);

        if (dropAtEnd) {
            currentPageItems.push(draggedItemId.toString());
        } else if (targetItemId) {
            const targetItemIndex = currentPageItems.indexOf(targetItemId.toString());
            if (targetItemIndex !== -1) {
                // Decide whether to insert before or after based on drop position relative to target midpoint (optional)
                // For simplicity, let's insert before the targetItem
                currentPageItems.splice(targetItemIndex, 0, draggedItemId.toString());
            } else {
                // Target item not found (should not happen if targetItemId is valid), append to end
                currentPageItems.push(draggedItemId.toString());
            }
        } else {
            // No valid drop target identified, revert or do nothing
            // For now, effectively cancels the drop if not on an item or the container end
            console.warn("No valid drop target for QAI.");
            state.draggedQAI = null;
            // No API call, no reload unless you want to revert visual changes
            loadQuickAddItems(state.currentQuickAddPage); // Reload to reset visual state
            return;
        }
        
        // Optimistically update UI (or wait for API call)
        // For now, we rely on API call and subsequent reloadQuickAddItems

        try {
            showToast('Reordering quick add items...', 'info');
            // API endpoint for reordering: PUT /api/quick_add_items/reorder
            // Body should contain { page_number: state.currentQuickAddPage, ordered_ids: currentPageItems }
            const payload = { 
                page_number: state.currentQuickAddPage, 
                ordered_ids: currentPageItems.map(id => parseInt(id)) // Ensure IDs are numbers
            };
            const result = await apiCall('/quick_add_items/reorder', 'PUT', payload);

            if (result && (result.success || (Array.isArray(result) && result.length > 0) || result.message)) { // Adjust success condition based on actual API response
                showToast('Quick add items reordered successfully.', 'success');
            } else if (result && result.error) {
                showToast(`Failed to reorder items: ${result.error}`, 'error');
            } else {
                showToast('Failed to reorder items. Unknown server response.', 'error');
            }
        } catch (error) {
            console.error('Error reordering Quick Add items:', error);
            showToast(`Error reordering items: ${error.message || 'Unknown error'}. See console.`, 'error');
        } finally {
            loadQuickAddItems(state.currentQuickAddPage); // Always reload to reflect server state
            state.draggedQAI = null;
        }
    }

    // --- Print Options Modal Functions ---
    window.openPrintOptionsModal = function(saleId) { // Make it global for access from searchAllSales
        if (!printOptionsModal || !printOptionsModalTitle || !printOptionsSaleIdInput) {
            console.error("Print Options Modal elements not found!");
            showToast("Error: Print options dialog is missing.", "error");
            return;
        }
        printOptionsModalTitle.textContent = `Print Options for Sale #${saleId}`;
        printOptionsSaleIdInput.value = saleId;
        printOptionsModal.style.display = 'block';
    }

    function closePrintOptionsModal() {
        if (printOptionsModal) {
            printOptionsModal.style.display = 'none';
        }
    }

    // --- Sale Item Edit Modal Functions ---

    // Helper to remove existing discount listeners to prevent multiple attachments
    function removeDiscountCalcListeners() {
        const el1 = document.getElementById('itemDiscountPercent');
        const el2 = document.getElementById('itemDiscountAbsolute');
        const el3 = document.getElementById('itemFinalPrice');
        if (el1) el1.replaceWith(el1.cloneNode(true)); // Simple way to remove listeners
        if (el2) el2.replaceWith(el2.cloneNode(true));
        if (el3) el3.replaceWith(el3.cloneNode(true));
    }

    window.openEditSaleItemModal = function(saleItemId, originalPriceStr, currentSalePriceStr, currentNotes, itemName) {
        // Re-fetch elements inside the function as they might have been replaced by removeDiscountCalcListeners
        const modal = document.getElementById('editSaleItemModal');
        const idInput = document.getElementById('editSaleItemId');
        const originalPriceHiddenInput = document.getElementById('editSaleItemOriginalPrice');
        const nameDisplay = document.getElementById('editSaleItemName');
        const originalPriceDisplaySpan = document.getElementById('editSaleItemOriginalPriceDisplay');
        const discountPercentInput = document.getElementById('itemDiscountPercent');
        const discountAbsoluteInput = document.getElementById('itemDiscountAbsolute');
        const finalPriceInput = document.getElementById('itemFinalPrice');
        const notesTextarea = document.getElementById('itemNotes');

        if (!modal || !idInput || !originalPriceHiddenInput || !nameDisplay || !originalPriceDisplaySpan || !discountPercentInput || !discountAbsoluteInput || !finalPriceInput || !notesTextarea) {
            console.error("Edit Sale Item Modal elements not found during open!");
            showToast("Error opening item editor: UI elements missing.", "error");
            return;
        }

        removeDiscountCalcListeners(); // Clear previous listeners before adding new ones
        // After removing listeners, we need to get fresh references to the input elements
        const freshDiscountPercentInput = document.getElementById('itemDiscountPercent');
        const freshDiscountAbsoluteInput = document.getElementById('itemDiscountAbsolute');
        const freshFinalPriceInput = document.getElementById('itemFinalPrice');

        const originalPrice = parseFloat(originalPriceStr) || 0;
        const currentSalePrice = parseFloat(currentSalePriceStr) || 0;

        idInput.value = saleItemId;
        originalPriceHiddenInput.value = originalPrice.toFixed(2); // Store for calculations
        nameDisplay.textContent = itemName || 'Item';
        originalPriceDisplaySpan.textContent = originalPrice.toFixed(2);
        notesTextarea.value = currentNotes || '';
        freshFinalPriceInput.value = currentSalePrice.toFixed(2);

        // Calculate initial discounts
        if (originalPrice > 0 && currentSalePrice < originalPrice) {
            const discountAbs = originalPrice - currentSalePrice;
            const discountPerc = (discountAbs / originalPrice) * 100;
            freshDiscountAbsoluteInput.value = discountAbs.toFixed(2);
            freshDiscountPercentInput.value = discountPerc.toFixed(2);
        } else {
            freshDiscountAbsoluteInput.value = '0.00';
            freshDiscountPercentInput.value = '0';
        }

        // Add interdependent listeners
        freshDiscountPercentInput.addEventListener('input', () => {
            const origPrice = parseFloat(originalPriceHiddenInput.value);
            const percent = parseFloat(freshDiscountPercentInput.value);
            if (!isNaN(origPrice) && !isNaN(percent) && origPrice > 0) {
                const absDiscount = (origPrice * percent) / 100;
                freshDiscountAbsoluteInput.value = absDiscount.toFixed(2);
                freshFinalPriceInput.value = (origPrice - absDiscount).toFixed(2);
            } else if (!isNaN(origPrice)) {
                freshDiscountAbsoluteInput.value = '0.00';
                freshFinalPriceInput.value = origPrice.toFixed(2);
            }
        });

        freshDiscountAbsoluteInput.addEventListener('input', () => {
            const origPrice = parseFloat(originalPriceHiddenInput.value);
            const absDiscount = parseFloat(freshDiscountAbsoluteInput.value);
            if (!isNaN(origPrice) && !isNaN(absDiscount)) {
                freshFinalPriceInput.value = (origPrice - absDiscount).toFixed(2);
                if (origPrice > 0) {
                    const percentDiscount = (absDiscount / origPrice) * 100;
                    freshDiscountPercentInput.value = percentDiscount.toFixed(2);
                } else {
                     freshDiscountPercentInput.value = '0';
                }
            }
        });

        freshFinalPriceInput.addEventListener('input', () => {
            const origPrice = parseFloat(originalPriceHiddenInput.value);
            const finalPrice = parseFloat(freshFinalPriceInput.value);
            if (!isNaN(origPrice) && !isNaN(finalPrice)) {
                const absDiscount = origPrice - finalPrice;
                freshDiscountAbsoluteInput.value = absDiscount.toFixed(2);
                if (origPrice > 0) {
                    const percentDiscount = (absDiscount / origPrice) * 100;
                    freshDiscountPercentInput.value = percentDiscount.toFixed(2);
                } else {
                     freshDiscountPercentInput.value = '0';
                }
            }
        });
        
        modal.style.display = 'block';
    };

    window.closeEditSaleItemModal = function() {
        const modal = document.getElementById('editSaleItemModal');
        if (modal) {
            modal.style.display = 'none';
            removeDiscountCalcListeners(); // Clean up listeners when modal is closed
        }
    };

    window.handleSaveSaleItemDetails = async function() {
        const idInput = document.getElementById('editSaleItemId');
        const finalPriceInput = document.getElementById('itemFinalPrice');
        const notesTextarea = document.getElementById('itemNotes');

        if (!idInput || !finalPriceInput || !notesTextarea || !state.currentSale || !state.currentSale.id) {
            showToast("Cannot save. Required info or active sale missing.", "error");
            return;
        }

        const saleItemId = idInput.value;
        const newSalePrice = parseFloat(finalPriceInput.value);
        const newNotes = notesTextarea.value.trim();

        if (isNaN(newSalePrice) || newSalePrice < 0) { // Allow 0 price, but not negative.
            showToast("Invalid final price.", "error");
            finalPriceInput.focus();
            return;
        }

        const payload = {
            sale_price: newSalePrice, // This is the final unit price
            notes: newNotes
        };

        try {
            const updatedSale = await apiCall(`/sales/${state.currentSale.id}/items/${saleItemId}`, 'PUT', payload);
            if (updatedSale && updatedSale.id) {
                state.currentSale = updatedSale;
                updateCartDisplay(); 
                showToast('Cart item updated!', 'success');
                closeEditSaleItemModal();
            } else {
                showToast('Failed to update item. Refreshing cart.', 'error');
                if (state.currentSale && state.currentSale.id) {
                    await loadSaleIntoCart(state.currentSale.id);
                }
                closeEditSaleItemModal();
            }
        } catch (error) {
            console.error('Error updating sale item:', error);
            showToast(`Error: ${error.message || 'Unknown error'}`, 'error');
            if (state.currentSale && state.currentSale.id) {
                await loadSaleIntoCart(state.currentSale.id);
            }
            closeEditSaleItemModal();
        }
    };

    // --- Initial Load ---
    servicePreloadItems(); // Call item service to preload
    loadParkedSales();
    serviceLoadAndDisplayCustomers(); // Initial call using customer service
    updateCartDisplay(); 
    loadQuickAddItems(state.currentQuickAddPage); // Load initial quick add items

    // --- Event Listeners ---
    // Item Search
    if (itemSearchButton) itemSearchButton.addEventListener('click', serviceSearchItems);
    if (itemClearSearchButton) {
        itemClearSearchButton.addEventListener('click', () => {
            if(itemSearchInput) itemSearchInput.value = '';
            // collapseItemSearchResults is from panelUtils.js, this will also trigger quick add to expand via searchItems logic in itemService if query is empty
            serviceSearchItems(); // Call with empty query to trigger collapse & quick add expansion
        });
    }
    if (itemSearchInput) {
        itemSearchInput.addEventListener('keyup', (event) => { if (event.key === 'Enter') serviceSearchItems(); });
        // itemSearchInput.addEventListener('blur', () => { setTimeout(collapseItemSearchResults, 200); }); // Optional
    }

    // Panels
    if (leftPanelExpandTag) leftPanelExpandTag.addEventListener('click', expandLeftPanel);
    
    // Dynamic Left Panel Sections
    if (customerManagementTitle && customerManagementSection && allSalesSearchSection) {
        customerManagementTitle.addEventListener('click', () => {
            toggleLeftPanelSection(customerManagementSection, allSalesSearchSection);
        });
    }
    if (allSalesSearchTitle && allSalesSearchSection && customerManagementSection) {
        allSalesSearchTitle.addEventListener('click', () => {
            toggleLeftPanelSection(allSalesSearchSection, customerManagementSection);
        });
    }

    // Cart Actions
    if (parkSaleButton) parkSaleButton.addEventListener('click', parkCurrentSale);
    if (setQuoteStatusButton) setQuoteStatusButton.addEventListener('click', handleSetQuoteStatus);
    if (voidSaleButton) voidSaleButton.addEventListener('click', handleVoidSale);
    if (finalizeSaleButton) finalizeSaleButton.addEventListener('click', handleFinalizeAndPay);
    
    // Payment Modal
    if (payCashButton) payCashButton.addEventListener('click', () => handleSubmitPayment('Cash'));
    if (payChequeButton) payChequeButton.addEventListener('click', () => handleSubmitPayment('Cheque'));
    if (payEftposButton) payEftposButton.addEventListener('click', () => handleSubmitPayment('EFTPOS'));
    if (invoiceRemainingButton) invoiceRemainingButton.addEventListener('click', handleInvoiceAndKeepOpen);

    // Customer Management & Modals
    if (closeAddCustomerModalButton) closeAddCustomerModalButton.addEventListener('click', serviceCloseAddCustomerModal);
    if (submitNewCustomerButton) submitNewCustomerButton.addEventListener('click', () => serviceHandleSaveNewCustomer(false));
    if (submitNewCustomerAndAddToSaleButton) submitNewCustomerAndAddToSaleButton.addEventListener('click', () => serviceHandleSaveNewCustomer(true));
    if (closeEditCustomerModalButton) closeEditCustomerModalButton.addEventListener('click', serviceCloseEditCustomerModal);
    if (submitUpdateCustomerButton) submitUpdateCustomerButton.addEventListener('click', serviceHandleUpdateCustomer);
    if (customerMgmtAddNewButton) customerMgmtAddNewButton.addEventListener('click', serviceOpenAddCustomerModal);
    if (customerMgmtSearchInput) customerMgmtSearchInput.addEventListener('input', serviceLoadAndDisplayCustomers);

    // All Sales Search
    if (searchSalesButton) searchSalesButton.addEventListener('click', searchAllSales);

    // Item Modals & Related
    if (openAddItemModalButton) openAddItemModalButton.addEventListener('click', serviceOpenAddItemForm);
    if (closeAddEditItemModalButton) closeAddEditItemModalButton.addEventListener('click', serviceCloseAddEditItemModal);
    if (submitItemButton) submitItemButton.addEventListener('click', () => serviceHandleSaveItem(false));
    if (submitItemAndAddToCartButton) submitItemAndAddToCartButton.addEventListener('click', () => serviceHandleSaveItem(true));
    if (manageVariantsButton) manageVariantsButton.addEventListener('click', serviceHandleManageVariantsClick);
    // itemImagesUploadInput 'change' listener is now part of serviceSetupItemImageDropZone
    if (closeVariantSelectionModalButton) closeVariantSelectionModalButton.addEventListener('click', serviceCloseVariantSelectionModal);
    if (closeImagePreviewModalButton) closeImagePreviewModalButton.addEventListener('click', serviceCloseImagePreviewModal);




    // Cart Item Actions (Delegated)
    if (cartItemsDiv) {
        cartItemsDiv.addEventListener('change', async (event) => {
            if (event.target.classList.contains('cart-item-quantity-input')) {
                const saleItemId = event.target.dataset.saleItemId;
                const newQuantity = parseInt(event.target.value, 10);
                if (saleItemId && !isNaN(newQuantity)) {
                    // The cart.js function handleUpdateCartItemQuantity will do further validation (e.g. min quantity)
                    await handleUpdateCartItemQuantity(saleItemId, newQuantity); 
                } else if (isNaN(newQuantity)) {
                    showToast('Invalid quantity entered.', 'error');
                    // Optionally, revert to old value if stored or re-fetch cart
                    const itemInCart = state.currentSale.sale_items.find(si => si.id == saleItemId);
                    if(itemInCart) event.target.value = itemInCart.quantity;
                }
            }
        });

        cartItemsDiv.addEventListener('click', (event) => {
            const editButton = event.target.closest('.edit-cart-item-btn');
            if (editButton) {
                const saleItemId = editButton.dataset.saleItemId;
                const itemName = editButton.dataset.itemName;
                const priceAtSale = editButton.dataset.priceAtSale;
                const currentNotes = editButton.dataset.currentNotes;
                
                // Find the actual sale item from state to get all details, especially current sale_price
                const saleItem = state.currentSale?.sale_items.find(si => si.id == saleItemId);
                if (saleItem) {
                    const currentSalePrice = saleItem.sale_price;
                    // openEditSaleItemModal is globally available from app.js
                    window.openEditSaleItemModal(saleItemId, priceAtSale, currentSalePrice, currentNotes, itemName);
                } else {
                    showToast('Could not find sale item details to edit.', 'error');
                }
                return; // Prevent further actions if edit button was clicked
            }

            const removeButton = event.target.closest('.remove-from-cart-btn');
            if (removeButton) {
                const saleItemId = removeButton.dataset.saleItemId;
                if (saleItemId) {
                    // Optional: Add a confirmation dialog here
                    // if (confirm('Are you sure you want to remove this item from the cart?')) {
                    handleRemoveItemFromCart(saleItemId);
                    // }
                }
                return; // Prevent further actions if remove button was clicked
            }
        });
    }

// Quick Add Dashboard Listeners

    if (closeQuickAddNewPageLinkModalBtn) closeQuickAddNewPageLinkModalBtn.addEventListener('click', closeQuickAddNewPageLinkModal);
    if (qaiSubmitNewPageLinkButton) qaiSubmitNewPageLinkButton.addEventListener('click', handleAddQuickAddPageLink);

    // Quick Add Grid Drag and Drop + Delete (Event Delegation)
    if (quickAddGridContainer) {
        quickAddGridContainer.addEventListener('dragstart', (e) => {
            const itemDiv = e.target.closest('.quick-add-item.editable:not(.is-back-button)');
            if(itemDiv) {
                const qaiId = itemDiv.dataset.qaiId;
                const qaiData = state.quickAddItemsCache.find(item => item.id && item.id.toString() === qaiId);
                if (qaiData) {
                    handleQAIDragStart(e, itemDiv, qaiData); 
                } else if (itemDiv.classList.contains('is-back-button')) {
                    e.preventDefault(); // Prevent dragging back button implicitly
                } else {
                    console.warn('Quick Add Item data not found in cache for drag start. ID:', qaiId, 'Cache:', state.quickAddItemsCache);
                    handleQAIDragStart(e,itemDiv, {}); // Pass empty object or handle in function
                }
            }
        });
        quickAddGridContainer.addEventListener('dragend', handleQAIDragEnd);
        quickAddGridContainer.addEventListener('dragover', handleQAIDragOver);
        quickAddGridContainer.addEventListener('drop', (e) => {
            let targetElement = e.target.closest('.quick-add-item');
            if (!targetElement && e.target === quickAddGridContainer) { 
                targetElement = quickAddGridContainer;
            }
            if (targetElement) {
                handleQAIDrop(e, targetElement);
            }
        });
        quickAddGridContainer.addEventListener('click', (event) => {
            const deleteButton = event.target.closest('.delete-qai-btn');
            if (deleteButton && state.isQuickAddEditMode) {
                const itemDiv = deleteButton.closest('.quick-add-item');
                if (itemDiv) {
                    const qaiId = itemDiv.dataset.qaiId;
                    const labelSpan = itemDiv.querySelector('.quick-add-item-image-label');
                    const qaiLabel = labelSpan ? labelSpan.textContent : (itemDiv.textContent || 'this item').replace('&times;','').trim();
                    handleDeleteQuickAddItem(qaiId, qaiLabel);
                }
            }
        });
    }

    // Edit Sale Item Modal Listeners (Remain global/unchanged)
    if (itemDiscountPercentInput) { /* ... */ }
    if (itemDiscountAbsoluteInput) { /* ... */ }

    // Global click listener for modals
    window.addEventListener('click', (event) => {
        const mainAddCustomerModal = document.getElementById('customerModal');
        const mainEditCustomerModal = document.getElementById('edit-customer-modal');
        const mainPaymentModal = document.getElementById('paymentModal');
        const mainVariantSelectionModal = document.getElementById('variant-selection-modal');
        const mainAddEditItemModal = document.getElementById('add-edit-item-modal');
        const mainImagePreviewModal = document.getElementById('imagePreviewModal');
        const mainQuickAddNewItemModal = document.getElementById('quick-add-new-item-modal');
        const mainQuickAddNewPageLinkModal = document.getElementById('quick-add-new-page-link-modal');
        const mainEditSaleItemModal = document.getElementById('editSaleItemModal');
        const mainPrintOptionsModal = document.getElementById('print-options-modal'); // Added

        if (event.target == mainAddCustomerModal) serviceCloseAddCustomerModal();
        if (event.target == mainEditCustomerModal) serviceCloseEditCustomerModal();
        if (event.target == mainPaymentModal) closePaymentModal();
        if (event.target == mainVariantSelectionModal) serviceCloseVariantSelectionModal();
        if (event.target == mainAddEditItemModal) serviceCloseAddEditItemModal();
        if (event.target == mainImagePreviewModal) serviceCloseImagePreviewModal();
        if (event.target == mainQuickAddNewItemModal) closeQuickAddNewItemModal();
        if (event.target == mainQuickAddNewPageLinkModal) closeQuickAddNewPageLinkModal();
        if (event.target == mainEditSaleItemModal) window.closeEditSaleItemModal();
        if (event.target == mainPrintOptionsModal) closePrintOptionsModal(); // Added
    });

    // Quick Add Dashboard
    if (quickAddEditModeBtn) quickAddEditModeBtn.addEventListener('click', toggleQuickAddEditMode);
    if (quickAddNewItemBtn) quickAddNewItemBtn.addEventListener('click', openQuickAddNewItemModal);
    if (quickAddNewPageLinkBtn) quickAddNewPageLinkBtn.addEventListener('click', openQuickAddNewPageLinkModal);
    if (closeQuickAddNewItemModalBtn) closeQuickAddNewItemModalBtn.addEventListener('click', closeQuickAddNewItemModal);
    if (qaiItemSearchButton) qaiItemSearchButton.addEventListener('click', handleSearchQAIItems);
    // Assuming qaiSubmitNewItemButton exists in the modal for quick add item (ID needs to be confirmed in HTML if issues persist)
    const qaiSubmitNewItemButton = document.getElementById('qai-submit-new-item-button');
    if (qaiSubmitNewItemButton) {
        qaiSubmitNewItemButton.addEventListener('click', async () => { 
            const selectedItemDiv = qaiItemSearchResultsDiv.querySelector('.qai-search-result.selected');
            if (selectedItemDiv) {
                const itemId = selectedItemDiv.dataset.itemId;
                const itemTitle = selectedItemDiv.dataset.itemTitle;
                const itemPrice = selectedItemDiv.dataset.itemPrice;
                const itemParentId = selectedItemDiv.dataset.itemParentId; // Get parentId
                await handleAddQuickAddItem(itemId, itemTitle, itemPrice, itemParentId); // Pass parentId
            } else {
                showToast("No item selected to add to Quick Add.", "warning");
            }
        });
    }
    if (closeQuickAddNewPageLinkModalBtn) closeQuickAddNewPageLinkModalBtn.addEventListener('click', closeQuickAddNewPageLinkModal);
    if (qaiSubmitNewPageLinkButton) qaiSubmitNewPageLinkButton.addEventListener('click', handleAddQuickAddPageLink);

    // Print Options Modal Buttons
    if (closePrintOptionsModalButton) closePrintOptionsModalButton.addEventListener('click', closePrintOptionsModal);
    
    const handlePrintAction = (docTypeForURL, formatForURL, saleId) => {
        if (!saleId) {
            showToast("Error: Sale ID is missing for printing.", "error");
            return;
        }
        // docTypeForURL will be 'invoice' or 'quote'
        // formatForURL will be 'a4' or 'receipt'
        const url = `/print/sale/${saleId}?doc_type=${docTypeForURL}&format=${formatForURL}`;
        window.open(url, '_blank');
        showToast(`Opening ${docTypeForURL} (${formatForURL}) for sale #${saleId}...`, 'info');
        closePrintOptionsModal(); // Close the modal after initiating print
    };

    if (printInvoiceA4Btn) printInvoiceA4Btn.addEventListener('click', () => handlePrintAction('invoice', 'a4', printOptionsSaleIdInput.value));
    if (printInvoiceReceiptBtn) printInvoiceReceiptBtn.addEventListener('click', () => handlePrintAction('invoice', 'receipt', printOptionsSaleIdInput.value));
    if (printQuoteA4Btn) printQuoteA4Btn.addEventListener('click', () => handlePrintAction('quote', 'a4', printOptionsSaleIdInput.value));
    if (printQuoteReceiptBtn) printQuoteReceiptBtn.addEventListener('click', () => handlePrintAction('quote', 'receipt', printOptionsSaleIdInput.value));

}); 