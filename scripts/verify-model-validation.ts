import { isValidModelId, AVAILABLE_MODELS } from '../lib/ai/models';

console.log('Testing isValidModelId...');

const validModel = AVAILABLE_MODELS[0];
const invalidModel = 'invalid-model-id';

console.log(`Checking valid model: ${validModel}`);
if (isValidModelId(validModel)) {
    console.log('✅ PASS: Valid model recognized.');
} else {
    console.error('❌ FAIL: Valid model rejected.');
    process.exit(1);
}

console.log(`Checking invalid model: ${invalidModel}`);
if (!isValidModelId(invalidModel)) {
    console.log('✅ PASS: Invalid model rejected.');
} else {
    console.error('❌ FAIL: Invalid model accepted.');
    process.exit(1);
}

console.log('All tests passed.');
