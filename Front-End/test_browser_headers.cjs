const http = require('http');

const data = JSON.stringify({ email: 'kirankushangala@gmail.com', password: 'SaiKiran@1998' });

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'content-length': '64',
    'sec-ch-ua-platform': '"Windows"',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Chromium";v="152", "Not?A_Brand";v="24", "Google Chrome";v="152"',
    dnt: '1',
    'content-type': 'application/json',
    'sec-ch-ua-mobile': '?0',
    accept: '*/*',
    origin: 'http://localhost:5175',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
    referer: 'http://localhost:5175/login',
    'accept-encoding': 'gzip, deflate, br, zstd',
    'accept-language': 'en-US,en;q=0.9,fr;q=0.8,hi;q=0.7,te;q=0.6,it;q=0.5',
    cookie: 'NEXT_LOCALE=en; auth_token=eyJhbGciOiJIUzI1NiJ9.eyJhdXRoZW50aWNhdGVkIjp0cnVlLCJleHAiOjE3OTA4Mzk0NTh9.TUx4wZ9J1QcVpQsqvyAMNycEhu6wMkLfjP7G7hTrSS8'
  }
};

const req = http.request(options, (res) => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => console.log('Status:', res.statusCode, '\nBody:', b));
});

req.write(data);
req.end();
