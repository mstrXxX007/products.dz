const unitPrice = 1800;
let shippingFee = 300;

const quantityInput = document.getElementById("quantity");
const shippingFeeElement = document.getElementById("shippingFee");
const totalPriceElement = document.getElementById("totalPrice");

const wilayaSelect = document.getElementById("wilaya");
const communeSelect = document.getElementById("commune");
const addressFields = document.getElementById("addressFields");

const orderForm = document.getElementById("orderForm");

let wilayasData = {};
let stopdeskData = {};


// --- CSV Parsing ---
async function fetchAndParseCSV(filePath, isStopdesk = false) {
  try {
    const response = await fetch(filePath);
    const csvData = await response.text();
    if (isStopdesk) {
      parseStopDeskCSV(csvData);
    } else {
      parseNormalCSV(csvData);
    }
  } catch (err) {
    console.error(`Failed to load CSV (${filePath}):`, err);
  }
}

function parseNormalCSV(csvData) {
  const rows = csvData.split("\n");
  rows.forEach(row => {
    const [id, communeName, , wilayaCode, wilayaName] = row.split(",");
    if (communeName && wilayaCode && wilayaName) {
      if (!wilayasData[wilayaCode]) {
        wilayasData[wilayaCode] = {
          name: wilayaName,
          communes: []
        };
      }
      wilayasData[wilayaCode].communes.push({ name: communeName.trim(), id });
    }
  });
}

function parseStopDeskCSV(csvData) {
  const rows = csvData.split("\n");
  // Skip the header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.trim()) continue;
    
    // Split by comma, but handle quoted values that might contain commas
    let columns = [];
    let inQuotes = false;
    let currentValue = '';
    
    for (let j = 0; j < row.length; j++) {
      const char = row[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        columns.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    
    columns.push(currentValue.trim());
    
    const [code, wilayaName, communesStr] = columns;
    
    if (code && wilayaName && communesStr) {
      // Remove any quotation marks from communes string
      const cleanCommunesStr = communesStr.replace(/"/g, '');
      // Split communes by comma
      const communes = cleanCommunesStr.split(",").map(c => c.trim());
      
      stopdeskData[code] = {
        name: wilayaName.trim(),
        communes: communes
      };
    }
  }
}

// Load both CSV files
fetchAndParseCSV("data/Algeria_HOME.csv");
fetchAndParseCSV("data/Algeria_STOPDESK.csv", true);

// --- Total Price Calculation ---
function updateTotal() {
  const quantity = parseInt(quantityInput.value) || 1;
  const deliveryButton = document.querySelector(".delivery-option.selected");
  const deliveryType = deliveryButton?.dataset.type;
  const defaultFee = parseInt(deliveryButton?.dataset.fee) || 0;

  // Free delivery for 2 items (stopdesk only)
  if (quantity === 2 && deliveryType === "stopdesk") {
    shippingFee = 0;
    shippingFeeElement.textContent = `0 DA`;
    totalPriceElement.textContent = `3600 DA`;
    return;
  }

  // Free delivery for 3+ items (any type)
  if (quantity >= 3) {
    shippingFee = 0;
    shippingFeeElement.textContent = `0 DA`;
    totalPriceElement.textContent = `5000 DA`;
    return;
  }

  // Revert to normal pricing
  shippingFee = defaultFee;
  const total = unitPrice * quantity + shippingFee;
  shippingFeeElement.textContent = `${shippingFee} DA`;
  totalPriceElement.textContent = `${total} DA`;
}

quantityInput.addEventListener("input", updateTotal);

// --- Delivery Option Handling ---
document.querySelectorAll(".delivery-option").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".delivery-option").forEach(btn => btn.classList.remove("selected"));
    button.classList.add("selected");

    // Reset shippingFee to default (based on button) and recalculate
    shippingFee = parseInt(button.dataset.fee) || 0;
    updateTotal();

    const deliveryType = button.dataset.type;
    
    // Always show wilaya and commune fields for both delivery types
    addressFields.style.display = "block";
    
    // Switch between regular and stopdesk data based on delivery type
    populateWilayas(deliveryType === "stopdesk");
    
    // Reset commune dropdown
    communeSelect.innerHTML = '<option value="">اختر البلدية</option>';
    
    if (deliveryType === "home") {
      // For home delivery, show the address input field
      document.getElementById("address").style.display = "block";
      document.querySelector('label[for="address"]').style.display = "block";
    } else {
      // For stopdesk, hide the address field
      document.getElementById("address").style.display = "none";
      document.querySelector('label[for="address"]').style.display = "none";
      document.getElementById("address").value = "";
    }
  });
});

// --- Wilaya and Commune Selection ---
function populateWilayas(isStopdesk = false) {
  wilayaSelect.innerHTML = '<option value="">اختر الولاية</option>';
  
  let dataSource = isStopdesk ? stopdeskData : wilayasData;
  
  // Sort by wilaya code
  const sortedWilayas = Object.entries(dataSource).sort(([a], [b]) => parseInt(a) - parseInt(b));

  sortedWilayas.forEach(([code, { name }]) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = `${code} - ${name}`;
    wilayaSelect.appendChild(option);
  });
}

wilayaSelect.addEventListener("change", () => {
  const selectedCode = wilayaSelect.value;
  communeSelect.innerHTML = '<option value="">اختر البلدية</option>';
  
  // Determine which data source to use based on selected delivery type
  const isStopdesk = document.querySelector(".delivery-option.selected")?.dataset.type === "stopdesk";
  const dataSource = isStopdesk ? stopdeskData : wilayasData;

  if (dataSource[selectedCode]) {
    if (isStopdesk) {
      // For stopdesk, communes are directly an array of strings
      const communes = dataSource[selectedCode].communes;
      communes.forEach((communeName, index) => {
        const option = document.createElement("option");
        option.value = `stopdesk_${selectedCode}_${index}`; // Create a unique value
        option.textContent = communeName;
        communeSelect.appendChild(option);
      });
    } else {
      // For home delivery, communes are objects with id and name
      const communes = [...dataSource[selectedCode].communes];
      communes.sort((a, b) => a.name.localeCompare(b.name));
      communes.forEach(commune => {
        const option = document.createElement("option");
        option.value = commune.id;
        option.textContent = commune.name;
        communeSelect.appendChild(option);
      });
    }
  }
});

// --- Form Submission ---
orderForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const fullName = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const quantity = quantityInput.value;
  const deliveryButton = document.querySelector(".delivery-option.selected");
  const deliveryType = deliveryButton ? deliveryButton.dataset.type : "غير محدد";
  const isStopdesk = deliveryType === "stopdesk";
  
  let wilayaCode = wilayaSelect.value;
  let communeId = communeSelect.value;
  let address = document.getElementById("address").value.trim();
  
  let wilayaName = "";
  let communeName = "";
  
  // Get wilaya and commune names based on delivery type
  if (isStopdesk) {
    wilayaName = stopdeskData[wilayaCode]?.name || "";
    
    // For stopdesk, extract the commune name from the selection
    if (communeId && communeId.startsWith("stopdesk_")) {
      const parts = communeId.split("_");
      const communeIndex = parseInt(parts[2]);
      communeName = stopdeskData[wilayaCode]?.communes[communeIndex] || "";
    }
  } else {
    wilayaName = wilayasData[wilayaCode]?.name || "";
    communeName = wilayasData[wilayaCode]?.communes.find(c => c.id === communeId)?.name || "";
  }

  // Validation for both delivery types - require wilaya and commune
  if (!wilayaCode || !communeId) {
    alert("يرجى اختيار الولاية والبلدية.");
    return;
  }

  // Additional validation for home delivery - require address
  if (!isStopdesk && !address) {
    alert("يرجى كتابة العنوان للتوصيل إلى المنزل.");
    return;
  }

  if (isStopdesk) {
    address = "N/A - StopDesk";
  }

  const formData = {
    name: fullName,
    phone: phone,
    deliveryType: deliveryType,
    wilaya: wilayaName,
    commune: communeName,
    address: address,
    quantity: quantity,
    shippingFee: shippingFeeElement.textContent,
    totalPrice: totalPriceElement.textContent
  };

  document.getElementById("waitModal").style.display = "flex";

  fetch("https://script.google.com/macros/s/AKfycbyDdbsWv45CcsAsL0hp1XMdbw_pl68-B7dhz2q5ht_4M59m9-oGcfDh-pZGK9JPwNY/exec", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(formData).toString(),
  })
    .then(res => res.text())
    .then(responseText => {
      document.getElementById("waitModal").style.display = "none";

      // Fill modal with order info
      document.getElementById("modalName").textContent = fullName;
      document.getElementById("modalPhone").textContent = phone;
      document.getElementById("modalDelivery").textContent = deliveryType;
      document.getElementById("modalWilaya").textContent = wilayaName;
      document.getElementById("modalCommune").textContent = communeName;
      document.getElementById("modalAddress").textContent = address;
      document.getElementById("modalQuantity").textContent = quantity;
      document.getElementById("modalShippingFee").textContent = shippingFeeElement.textContent;
      document.getElementById("modalTotalPrice").textContent = totalPriceElement.textContent;

      document.getElementById("successModal").style.display = "flex";

      orderForm.reset();
      communeSelect.innerHTML = '<option value="">اختر البلدية</option>';
      updateTotal();
    })
    .catch(err => {
      document.getElementById("waitModal").style.display = "none";
      alert("There was an error submitting the order. Please try again.");
      console.error("Submission error:", err);
    });
});

// Set default delivery method to "stopdesk" on page load
window.addEventListener("load", () => {
  const defaultDeliveryButton = document.querySelector(".delivery-option[data-type='stopdesk']");
  if (defaultDeliveryButton) {
    defaultDeliveryButton.classList.add("selected");
    
    // Show wilaya/commune but hide address field
    addressFields.style.display = "block";
    document.getElementById("address").style.display = "none";
    document.querySelector('label[for="address"]').style.display = "none";
    
    shippingFee = parseInt(defaultDeliveryButton.dataset.fee) || 0;
    updateTotal();
    
    // Initialize with stopdesk data
    populateWilayas(true);
  }
});
