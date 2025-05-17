export const state = {
    currentSale: null, // Will hold sale ID and items
    currentCustomer: null,
    itemsCache: [], // Cache for item details
    quickAddItemsCache: [], // Cache for currently loaded quick add items
    isQuickAddEditMode: false,
    draggedQAI: null, // To store the element being dragged
    currentQuickAddPage: 1
}; 