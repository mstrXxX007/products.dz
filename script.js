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

// --- CSV Parsing ---
async function fetchAndParseCSV(filePath) {
  try {
    const response = await fetch(filePath);
    const csvData = await response.text();
    parseCSV(csvData);
  } catch (err) {
    console.error("Failed to load CSV:", err);
  }
}

function parseCSV(csvData) {
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
  populateWilayas();
}

fetchAndParseCSV("data/algeria_cities.csv");

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
    if (deliveryType === "home") {
      addressFields.style.display = "block";
    } else {
      addressFields.style.display = "none";
      wilayaSelect.value = "";
      communeSelect.innerHTML = '<option value="">اختر البلدية</option>';
      document.getElementById("address").value = "";
    }
  });
});

// --- Wilaya and Commune Selection ---
function populateWilayas() {
  wilayaSelect.innerHTML = '<option value="">اختر الولاية</option>';
  const sortedWilayas = Object.entries(wilayasData).sort(([a], [b]) => parseInt(a) - parseInt(b));

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

  if (wilayasData[selectedCode]) {
    const communes = [...wilayasData[selectedCode].communes];
    communes.sort((a, b) => a.name.localeCompare(b.name));
    communes.forEach(commune => {
      const option = document.createElement("option");
      option.value = commune.id;
      option.textContent = commune.name;
      communeSelect.appendChild(option);
    });
  }
});

// --- Form Submission ---
orderForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const fullName = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const quantity = quantityInput.value;
  const deliveryButton = document.querySelector(".delivery-option.selected");
  const deliveryType = deliveryButton ? deliveryButton.textContent : "غير محدد";

  let wilayaCode = wilayaSelect.value;
  let communeId = communeSelect.value;
  let address = document.getElementById("address").value.trim();
  let wilayaName = wilayasData[wilayaCode]?.name || "";
  let communeName = wilayasData[wilayaCode]?.communes.find(c => c.id === communeId)?.name || "";

  // ✅ Validation for home delivery
  if (deliveryButton?.dataset.type === "home") {
    if (!wilayaCode || !communeId || !address) {
      alert("يرجى اختيار الولاية والبلدية وكتابة العنوان للتوصيل إلى المنزل.");
      return;
    }
  }

  if (deliveryButton?.dataset.type === "stopdesk") {
    address = "N/A";
    communeName = "N/A";
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
