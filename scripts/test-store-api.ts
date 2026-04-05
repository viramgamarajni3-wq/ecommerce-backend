import axios from 'axios';

async function test() {
  const handle = 'Endsadadas-sdsd-1774636211162';
  const url = `http://localhost:9000/store/products?handle=${handle}&limit=1`;
  
  try {
    console.log(`Testing backend: ${url}`);
    const res = await axios.get(url);
    console.log('Response Status:', res.status);
    console.log('Products found:', res.data.products.length);
    if (res.data.products.length > 0) {
      console.log('Product Title:', res.data.products[0].title);
    }
  } catch (err: any) {
    console.error('Error:', err.response?.status, err.response?.data || err.message);
  }
}

test();
