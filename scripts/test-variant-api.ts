import axios from 'axios';

async function testCurl() {
  const url = 'http://localhost:9000/api/v1/admin/products/a3467e1c-f753-4a2e-af3f-4a7c2d09173e/variants';
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhN2MyY2NlMy1kYWJmLTQ3ZGUtOWU3Ni1mYWQ3MDYxMmNmZWYiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzQ5NjkwOTYsImV4cCI6MTc3NTA1NTQ5Nn0.tQDr-S01iK4tni_BzTPubPY9zkIT0LGwYyf2OwMNvLU';
  
  const data = {
    title: "S / yellow",
    sku: "NAM IMPEDIT NON SIM-S-YELLOW-" + Date.now(), // avoid SKU conflict
    price: "390.00",
    stock_quantity: 0,
    attributes: {
      size: "S",
      color: "yellow"
    }
  };

  try {
    const res = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log("Response Status:", res.status);
    console.log("Response Data:", JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error("Error Status:", err.response?.status);
    console.error("Error Data:", JSON.stringify(err.response?.data, null, 2));
  }
}

testCurl();
