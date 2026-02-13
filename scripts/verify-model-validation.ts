import { isValidModelId, AVAILABLE_MODELS } from '../lib/ai/models';

console.log('Verifying isValidModelId function...');

const validModels = [...AVAILABLE_MODELS];
const invalidModels = ['gpt-4-32k', 'claude-3-opus', 'unknown-model', '', '   '];

let passed = true;

console.log('Checking valid models:');
for (const model of validModels) {
  if (isValidModelId(model)) {
    console.log(`✅ Valid model correctly accepted: ${model}`);
  } else {
    console.error(`❌ Valid model incorrectly rejected: ${model}`);
    passed = false;
  }
}

console.log('\nChecking invalid models:');
for (const model of invalidModels) {
  if (!isValidModelId(model)) {
    console.log(`✅ Invalid model correctly rejected: ${model}`);
  } else {
    console.error(`❌ Invalid model incorrectly accepted: ${model}`);
    passed = false;
  }
}

if (passed) {
  console.log('\nAll checks passed! Security fix verified.');
  process.exit(0);
} else {
  console.error('\nSome checks failed.');
  process.exit(1);
}
