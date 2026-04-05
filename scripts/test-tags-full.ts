import axios from 'axios';

async function test() {
  const url = "http://localhost:9000/api/v1/admin/tags";
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhN2MyY2NlMy1kYWJmLTQ3ZGUtOWU3Ni1mYWQ3MDYxMmNmZWYiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NzQ1NTQwODksImV4cCI6MTc3NDY0MDQ4OX0.PjKJbmO3mPOWmeDztLXloLlW4gwKq4vE__rynRCjqXU";
  
  try {
    const data = {
      name: "test",
      color: "#f97316"
    };

    const res = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    console.log("POST SUCCESS:", JSON.stringify(res.data, null, 2));

    const getRes = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    console.log("GET SUCCESS:", JSON.stringify(getRes.data, null, 2));

  } catch (e: any) {
    console.error("FAILED:", e.response?.status, e.response?.data || e.message);
  }
}

test();
