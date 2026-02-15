import { isValidModelId, AVAILABLE_MODELS } from '../lib/ai/models';

function verify() {
  console.log('Verifying model validation...');

  let passed = true;

  // Test valid models
  for (const model of AVAILABLE_MODELS) {
    if (!isValidModelId(model)) {
      console.error(`❌ Valid model rejected: ${model}`);
      passed = false;
    } else {
        console.log(`✅ Valid model accepted: ${model}`);
    }
  }

  // Test invalid model
  const invalidModel = 'invalid-model-id';
  if (isValidModelId(invalidModel)) {
    console.error(`❌ Invalid model accepted: ${invalidModel}`);
    passed = false;
  } else {
    console.log(`✅ Invalid model rejected: ${invalidModel}`);
  }

  // Test another invalid model (partial match)
  const partialModel = 'openai/gpt-oss-120b';
  if (isValidModelId(partialModel)) {
      console.error(`❌ Partial model accepted: ${partialModel}`);
      passed = false;
  } else {
      console.log(`✅ Partial model rejected: ${partialModel}`);
  }

  if (passed) {
    console.log('🎉 All checks passed!');
    process.exit(0);
  } else {
    console.error('💥 Some checks failed.');
    process.exit(1);
  }
}

verify();
