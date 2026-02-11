
import { isValidModelId, AVAILABLE_MODELS } from '../lib/ai/models';

console.log('Running verification for isValidModelId...');

let hasError = false;

// Test 1: Valid models
console.log('Testing valid models...');
AVAILABLE_MODELS.forEach((model) => {
    if (isValidModelId(model)) {
        console.log(`✅ ${model} is valid`);
    } else {
        console.error(`❌ ${model} should be valid but failed`);
        hasError = true;
    }
});

// Test 2: Invalid models
console.log('\nTesting invalid models...');
const invalidModels = [
    'invalid-model-id',
    'openai/gpt-4o-mini', // Internal model not in AVAILABLE_MODELS
    '',
    undefined,
    null
];

invalidModels.forEach((model) => {
    if (!isValidModelId(model as any)) {
        console.log(`✅ ${model} is correctly rejected`);
    } else {
        console.error(`❌ ${model} should be invalid but was accepted`);
        hasError = true;
    }
});

if (hasError) {
    console.error('\nVerification FAILED');
    process.exit(1);
} else {
    console.log('\nVerification PASSED');
}
