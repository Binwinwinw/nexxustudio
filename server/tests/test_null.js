const phaseData = null;
try {
  console.log("Phase:", phaseData?.phase || 'DISCOVERY');
} catch (e) {
  console.error("Error:", e.message);
}
