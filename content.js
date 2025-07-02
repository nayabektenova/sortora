// content.js — Injected into Facebook Marketplace pages

// Utility: Waits for a DOM element to appear
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        resolve(el);
        observer.disconnect();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error("Element not found: " + selector));
    }, timeout);
  });
}

// Core logic: Applies filters from Sortora
async function applySortoraFilters(filters) {
  console.log("Received filters:", filters);

  try {
    const query = [filters.query, filters.condition, filters.category]
      .filter(Boolean)
      .join(" ");

    // Search box
    const searchBox = await waitForElement('input[placeholder*="Search Marketplace"]');
    searchBox.value = query;
    searchBox.dispatchEvent(new Event("input", { bubbles: true }));

    // Price fields
    if (filters.minPrice || filters.maxPrice) {
      const minInput = await waitForElement('[aria-label*="Minimum Price"]');
      const maxInput = await waitForElement('[aria-label*="Maximum Price"]');

      if (filters.minPrice) {
        minInput.value = filters.minPrice;
        minInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (filters.maxPrice) {
        maxInput.value = filters.maxPrice;
        maxInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    // Sorting
    if (filters.sortBy === "price_ascend") {
      const sortBtn = await waitForElement('[aria-label*="Sort"]');
      sortBtn.click();
      setTimeout(() => {
        const lowToHighOption = [...document.querySelectorAll("span")]
          .find(span => span.innerText.includes("Price: Low to High"));
        if (lowToHighOption) lowToHighOption.click();
      }, 500);
    }

    alert("Sortora filters applied!");
  } catch (err) {
    console.error("Error applying filters:", err.message);
    alert("Could not apply filters.");
  }
}

// Listen for popup messages
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "APPLY_FILTERS") {
    applySortoraFilters(msg.filters);
  }
});
