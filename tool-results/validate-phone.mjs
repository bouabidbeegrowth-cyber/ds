const pattern = /^(?:\+213[2-4]\d{7}|\+213[5-7]\d{8}|0[2-4]\d{7}|0[5-7]\d{8})$/;
const normalize = (value) => value.replace(/[\s.-]/g, '');
const isAlgerianPhoneNumber = (value) => pattern.test(normalize(value.trim()));

const samples = [
  '0555123456',
  '05 55 12 34 56',
  '+213 5 55 12 34 56',
  '021234567',
  '+213 21 23 45 67',
  '1234567890',
  '+212 5 55 12 34 56',
  '08 55 12 34 56',
];

for (const sample of samples) {
  console.log(`${sample} -> ${isAlgerianPhoneNumber(sample)}`);
}
