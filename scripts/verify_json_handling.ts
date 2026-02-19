
async function verifyEndpoint(url: string) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{ "invalid": ', // Malformed JSON
    });

    if (response.status === 400) {
      console.log(`✅ ${url}: Passed (Status 400)`);
      return true;
    } else {
      console.log(`❌ ${url}: Failed (Status ${response.status})`);
      return false;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`❌ ${url}: Error (${message})`);
    return false;
  }
}

async function main() {
  const baseUrl = 'http://localhost:3000';
  const endpoints = [
    '/api/chat',
    '/api/locations/resolve',
    '/api/simulate',
    '/api/storage',
  ];

  console.log('Starting API JSON Handling Verification...');
  let allPassed = true;

  // Wait for server to be up
  let retries = 0;
  while (retries < 20) {
    try {
      await fetch(baseUrl);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      retries++;
      if (retries % 5 === 0) console.log('Waiting for server...');
    }
  }

  if (retries >= 20) {
    console.error('Server failed to start.');
    process.exit(1);
  }

  for (const endpoint of endpoints) {
    const passed = await verifyEndpoint(`${baseUrl}${endpoint}`);
    if (!passed) allPassed = false;
  }

  if (allPassed) {
    console.log('🎉 All endpoints handle invalid JSON correctly.');
    process.exit(0);
  } else {
    console.error('⚠️ Some endpoints failed verification.');
    process.exit(1);
  }
}

main();
