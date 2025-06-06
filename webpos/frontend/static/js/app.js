// Basic POS System - app.js
import { apiCall } from './apiService.js';
import { showToast } from './toastService.js';
import { state } from './uiState.js'; 
import {
    createNewSale, 
    loadSaleIntoCart,
    updateCartCustomerDisplay, 
    updateCartDisplay, 
    initCartService,
    handleUpdateCartItemQuantity,
    handleRemoveItemFromCart,
    openEditSaleItemModal,
    closeEditSaleItemModal
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
import { initCombinationItemService } from './combinationItemService.js';
import { initPaymentService, openPaymentModal as serviceOpenPaymentModal } from './paymentService.js';
import { initPrintService } from './printService.js';
import { initQuickAddService, loadQuickAddItems as serviceLoadQuickAddItems } from './quickAddService.js';
import { initSalesService, loadParkedSales } from './salesService.js';


document.addEventListener('DOMContentLoaded', () => {
    console.log("POS App Loaded");

    initCustomerService(updateCartDisplay, createNewSale, updateCartCustomerDisplay);
    initItemService();
    initCombinationItemService();
    initPaymentService();
    initPrintService();
    initCartService();
    initQuickAddService();
    initSalesService();

    console.log("All services initialized");

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
   
    const cartItemsDiv = document.getElementById('cart-items');

    // --- Initial Load Functions ---
    loadParkedSales();
    servicePreloadItems();
    setTimeout(() => {
        serviceLoadQuickAddItems(1);
        console.log("Delayed loadQuickAddItems called after 2s timeout");
    }, 2000); 
    serviceLoadAndDisplayCustomers();
    
    // --- Finalize and Pay --- 
    async function handleFinalizeAndPay() {
        console.log("handleFinalizeAndPay called in app.js. currentSale:", state.currentSale);
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
        // Use the statically imported and aliased serviceOpenPaymentModal
        serviceOpenPaymentModal(saleToProcess); 
    }

    async function parkCurrentSale() {
        if (state.currentSale && state.currentSale.id) {
            let saleToParkStatus = state.currentSale.status;
            if (saleToParkStatus !== 'Open' && saleToParkStatus !== 'Quote' && saleToParkStatus !== 'Invoice') {
                showToast(`Sale ${state.currentSale.id} (${state.currentSale.status}) parked.`, "info");
            } else {
                showToast(`Sale ${state.currentSale.id} (${state.currentSale.status}) parked.`, "info");
            }
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
            // Open print options modal after setting as quote
            // openPrintOptionsModal(state.currentSale.id);
        } else {
            showToast("Failed to update sale to Quote status.", 'error');
        }
    }

    async function handleVoidSale() {
        if (!state.currentSale || !state.currentSale.id) {
            showToast("No active sale to clear.", 'warning');
            return;
        }

        const saleIdToPotentiallyVoid = state.currentSale.id;
        const originalStatus = state.currentSale.status;

        // --- Primary Action: Clear the local cart immediately --- 
        state.currentSale = null;
        state.currentCustomer = null;
        updateCartDisplay();
        showToast("Cart has been cleared.", 'info');
        console.log(`Local cart cleared. Sale ID was: ${saleIdToPotentiallyVoid}, Original status: ${originalStatus}.`);
        // --- End of Primary Action ---

        // --- Secondary Action: Attempt backend void if applicable ---
        if (originalStatus !== 'Void') {
            try {
                console.log(`Attempting to set sale ${saleIdToPotentiallyVoid} to Void on backend. Original status: ${originalStatus}`);
                const updatedSale = await apiCall(`/sales/${saleIdToPotentiallyVoid}/status`, 'PUT', { status: 'Void' });
                if (updatedSale && updatedSale.id) {
                    showToast(`Sale ${updatedSale.id} status updated to Void on server.`, 'success');
                } else {
                    showToast(`Failed to confirm sale ${saleIdToPotentiallyVoid} status update on server. Please check server logs.`, 'warning');
                }
            } catch (error) {
                showToast(`Error trying to void sale ${saleIdToPotentiallyVoid} on server: ${error.message}`, 'error');
                console.error("Error during backend void POST operation:", error);
            }
        }
        // --- End of Secondary Action ---
        
        // Always refresh parked sales list to reflect any potential status changes or ensure consistency
        loadParkedSales();
    }

    // --- Event Listeners ---
    // Item Search
    if (itemSearchButton) itemSearchButton.addEventListener('click', () => serviceSearchItems(itemSearchInput.value));
    if (itemClearSearchButton) {
        itemClearSearchButton.addEventListener('click', () => {
            if(itemSearchInput) itemSearchInput.value = '';
            serviceSearchItems(''); // Clear results
        });
    }
    if (itemSearchInput) {
        itemSearchInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                serviceSearchItems(itemSearchInput.value);
            }
        });
    }

    // Panels
    if (leftPanelExpandTag) leftPanelExpandTag.addEventListener('click', expandLeftPanel);
    
    // Dynamic Left Panel Sections
    const leftPanelTitles = document.querySelectorAll('.left-panel-section-title');
    
    // Initialize sections
    leftPanelTitles.forEach(title => {
        const parentSection = title.parentElement; // .left-panel-section container
        const content = title.nextElementSibling;  // .left-panel-section-content div

        if (!parentSection || !content) return;

        // Determine initial visibility. Make "Find Sales" visible by default.
        const isCurrentlyVisible = true; // Start with all sections expanded

        // Apply classes to the SECTION (not the content) so flex behaviour works
        parentSection.classList.toggle('collapsed-section', !isCurrentlyVisible);
        parentSection.classList.toggle('expanded-section', isCurrentlyVisible);
        parentSection.classList.toggle('collapsed', !isCurrentlyVisible);
        parentSection.classList.toggle('expanded', isCurrentlyVisible);

        // Show / hide content
        content.style.display = isCurrentlyVisible ? 'block' : 'none';

        // Store state
        parentSection.setAttribute('data-expanded', isCurrentlyVisible.toString());

        // Insert the expand / collapse icon if it isn't there yet
        if (!title.querySelector('.expand-icon')) {
            const expandIcon = document.createElement('span');
            expandIcon.className = 'expand-icon';
            expandIcon.textContent = isCurrentlyVisible ? '▲' : '▼';
            title.insertBefore(expandIcon, title.firstChild);
        }
    });
    
    // Add click handlers
    leftPanelTitles.forEach(title => {
        title.addEventListener('click', () => {
            const parentSection = title.parentElement;
            const content = title.nextElementSibling;
            if (!parentSection || !content) return;

            const isExpanded = parentSection.getAttribute('data-expanded') === 'true';

            // Toggle classes on the SECTION
            parentSection.classList.toggle('collapsed-section', isExpanded);
            parentSection.classList.toggle('expanded-section', !isExpanded);
            parentSection.classList.toggle('collapsed', isExpanded);
            parentSection.classList.toggle('expanded', !isExpanded);

            // Show / hide content
            content.style.display = isExpanded ? 'none' : 'block';

            // Store new state
            parentSection.setAttribute('data-expanded', (!isExpanded).toString());

            // Update the indicator icon
            const expandIcon = title.querySelector('.expand-icon');
            if (expandIcon) {
                expandIcon.textContent = isExpanded ? '▼' : '▲';
            }
        });
    });

    // Cart Actions
    if (parkSaleButton) parkSaleButton.addEventListener('click', parkCurrentSale);
    if (setQuoteStatusButton) setQuoteStatusButton.addEventListener('click', handleSetQuoteStatus);
    if (voidSaleButton) voidSaleButton.addEventListener('click', handleVoidSale);
    if (finalizeSaleButton) finalizeSaleButton.addEventListener('click', handleFinalizeAndPay);
    
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
                    openEditSaleItemModal(saleItem);
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
        if (event.target == mainEditSaleItemModal) closeEditSaleItemModal();
        if (event.target == mainPrintOptionsModal) closePrintOptionsModal(); // Added
    });

    // Quick Add Dashboard listeners are now in quickAddService.js and initialized via initQuickAddService()
    // REMOVE: if (quickAddEditModeBtn) quickAddEditModeBtn.addEventListener('click', toggleQuickAddEditMode);
    // REMOVE: if (quickAddNewItemBtn) quickAddNewItemBtn.addEventListener('click', openQuickAddNewItemModal);
    // REMOVE: if (quickAddNewPageLinkBtn) quickAddNewPageLinkBtn.addEventListener('click', openQuickAddNewPageLinkModal);
    // REMOVE: if (closeQuickAddNewItemModalBtn) closeQuickAddNewItemModalBtn.addEventListener('click', closeQuickAddNewItemModal);
    // REMOVE: if (qaiItemSearchButton) qaiItemSearchButton.addEventListener('click', handleSearchQAIItems);
    // REMOVE: The qaiSubmitNewItemButton listener block
    // REMOVE: if (closeQuickAddNewPageLinkModalBtn) closeQuickAddNewPageLinkModalBtn.addEventListener('click', closeQuickAddNewPageLinkModal);
    // REMOVE: if (qaiSubmitNewPageLinkButton) qaiSubmitNewPageLinkButton.addEventListener('click', handleAddQuickAddPageLink);

    // Print Options Modal Buttons are in printService.js
    // REMOVE: if (closePrintOptionsModalButton) closePrintOptionsModalButton.addEventListener('click', closePrintOptionsModal);
    // REMOVE: The handlePrintAction function and its associated button listeners
    
}); 