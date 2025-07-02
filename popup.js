document.getElementById("applyBtn").addEventListener("click", async () => {
  const queryInput = document.getElementById("query");
  const applyBtn = document.getElementById("applyBtn");
  const query = queryInput.value.trim();

  if (!query) {
    alert("Please enter a filter query.");
    return;
  }

  applyBtn.disabled = true;
  applyBtn.innerText = "Thinking...";

  try {
    const response = await fetch("https://parsequery-gpylux3xbq-uc.a.run.app", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    const result = await response.json();
    if (!result.result) throw new Error("No result from backend");

    let parsed;
    try {
      parsed = JSON.parse(result.result);
    } catch (err) {
      console.error("Could not parse result as JSON:", result.result);
      alert("Could not parse filters. Check format.");
      return;
    }

    // Show parsed filters in the popup UI
    const previewBox = document.getElementById("preview");
    const outputBox = document.getElementById("filtersOutput");
    if (previewBox && outputBox) {
      previewBox.style.display = "block";
      outputBox.textContent = JSON.stringify(parsed, null, 2);
    }

    console.log("Parsed filters:", parsed);

    // Check for vehicle related searches (but only if it's actually about vehicles)
    const isVehicleCategory = (parsed.category || "").toLowerCase().trim() === "vehicles";

    const vehicleKeywordMatch = (() => {
      const combined = [parsed.query, parsed.category, parsed.brand]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const strictVehicleTerms = /\b(car|truck|suv|van|sedan|hatchback|motorcycle)\b/;
      return strictVehicleTerms.test(combined);
    })();

    const isVehicleQuery = isVehicleCategory || vehicleKeywordMatch;

    if (isVehicleQuery) {
      const vehicleParams = new URLSearchParams();
      vehicleParams.set("topLevelVehicleType", "car_truck");

      if (parsed.query) vehicleParams.set("query", parsed.query);
      if (parsed.carType) vehicleParams.set("carType", parsed.carType.toLowerCase());
      if (parsed.yearMin) vehicleParams.set("minYear", parsed.yearMin.toString());
      if (parsed.mileageMax) vehicleParams.set("maxMileage", parsed.mileageMax.toString());
      if (parsed.color) vehicleParams.set("vehicleExteriorColors", parsed.color.toLowerCase());
      if (parsed.interiorColor) vehicleParams.set("vehicleInteriorColors", parsed.interiorColor.toLowerCase());

      const sort = (parsed.sort || "").toLowerCase();
      if (sort.includes("mileage")) {
        vehicleParams.set("sortBy", "vehicle_mileage_ascend");
      } else if (sort.includes("low to high")) {
        vehicleParams.set("sortBy", "price_ascend");
      } else if (sort.includes("high to low")) {
        vehicleParams.set("sortBy", "price_descend");
      } else if (sort.includes("new") || sort.includes("recent")) {
        vehicleParams.set("sortBy", "creation_time_descend");
      }

      const vehicleURL = `https://www.facebook.com/marketplace/category/vehicles?${vehicleParams.toString()}`;
      console.log("Vehicle URL:", decodeURIComponent(vehicleURL));

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.update(tabs[0].id, { url: vehicleURL });
      });

      return; // Stop here for vehicle flow
    }

    // General marketplace search
    const params = new URLSearchParams();

    // Build a clean query string
    let queryTerms = "";
    if (parsed.query || parsed.brand) {
      queryTerms = [parsed.query, parsed.brand]
        .filter(Boolean)
        .filter((term, index, arr) => arr.indexOf(term) === index)
        .join(" ");
    }
    if (!queryTerms) {
      queryTerms = query;
    }
    params.set("query", queryTerms.trim());

    // Price range logic
    let min = "", max = "";
    if (typeof parsed.priceRange === "object" && parsed.priceRange !== null) {
      min = parsed.priceRange.min ?? "";
      max = parsed.priceRange.max ?? "";
    } else if (typeof parsed.priceRange === "string") {
      const matchBetween = parsed.priceRange.match(/\$?(\d+)[^\d]+(?:and|to)[^\d]+\$?(\d+)/i);
      const matchUnder = parsed.priceRange.match(/under\s*\$?(\d+)/i);
      const matchAbove = parsed.priceRange.match(/(above|over)\s*\$?(\d+)/i);
      const matchExact = parsed.priceRange.match(/\$?(\d+)\s*-\s*\$?(\d+)/);

      if (matchBetween) {
        min = matchBetween[1];
        max = matchBetween[2];
      } else if (matchExact) {
        min = matchExact[1];
        max = matchExact[2];
      } else if (matchUnder) {
        max = matchUnder[1];
      } else if (matchAbove) {
        min = matchAbove[2];
      }
    }

    if ((min && Number(min) > 0) || (max && Number(max) > 0)) {
      if (min) params.set("minPrice", min.toString());
      if (max) params.set("maxPrice", max.toString());
    }

    // Delivery method
    if (parsed.delivery) {
      const delivery = parsed.delivery.toLowerCase();
      if (delivery.includes("local")) {
        params.set("deliveryMethod", "2");
      } else if (delivery.includes("ship")) {
        params.set("deliveryMethod", "1");
      }
    }

    // Sorting logic
    const sortValue = (parsed.sort || "").toLowerCase();
    if (sortValue.includes("low to high")) {
      params.set("sortBy", "price_ascend");
    } else if (sortValue.includes("high to low")) {
      params.set("sortBy", "price_descend");
    } else if (sortValue.includes("new") || sortValue.includes("recent")) {
      params.set("sortBy", "creation_time_descend");
    }

    // Radius
    if (parsed.radius && !isNaN(parsed.radius)) {
      params.set("radiusKM", parsed.radius.toString());
    }

    // Date posted
    if (parsed.datePosted) {
      const match = parsed.datePosted.match(/(\d+)/);
      if (match) {
        params.set("daysSinceListed", match[1]);
      }
    }

    const finalUrl = `https://www.facebook.com/marketplace/106378336067638/search/?${params.toString()}`;
    console.log("Final general URL:", decodeURIComponent(finalUrl));

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.update(tabs[0].id, { url: finalUrl });
    });

  } catch (err) {
    console.error("Error:", err.message);
    alert("Sortora failed to get a response from the server.");
  } finally {
    applyBtn.disabled = false;
    applyBtn.innerText = "Apply";
  }
});
