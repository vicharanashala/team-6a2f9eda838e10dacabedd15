const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- STARTING ANOMALY DETECTION E2E API TESTS ---');

  // Helper for requests
  const request = async (url, options = {}) => {
    const res = await fetch(BASE_URL + url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    }
    return data;
  };

  // 1. Log in as student
  console.log('\n1. Logging in as student...');
  const studentAuth = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'student@quorafaq.com', password: 'student123' }),
  });
  const studentToken = studentAuth.token;
  console.log('Logged in successfully. Token acquired.');

  // 2. Post a high-severity question
  console.log('\n2. Posting high-severity question...');
  const highQ = await request('/questions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({
      title: 'Cannot access my courses',
      body: 'Please help immediately, blocked from, nobody is helping. Extremely urgent.',
      tags: ['Vibe LMS'],
      category: 'ViBe Platform'
    }),
  });
  console.log(`Question created: ID=${highQ.question._id}`);
  console.log(`Anomaly Score: ${highQ.question.anomalyScore}`);
  console.log(`Anomaly Severity: ${highQ.question.anomalySeverity}`);
  if (highQ.question.anomalySeverity !== 'high') {
    throw new Error(`Expected severity 'high', got '${highQ.question.anomalySeverity}'`);
  }
  console.log('✓ High-severity auto-classification verified!');
 
  // 3. Post a low-severity question
  console.log('\n3. Posting low-severity question...');
  const lowQ = await request('/questions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({
      title: 'How to write binary search in Python',
      body: 'Can someone provide a simple implementation of the binary search algorithm in Python?',
      tags: ['Getting Started'],
      category: 'ViBe Platform'
    }),
  });
  console.log(`Question created: ID=${lowQ.question._id}`);
  console.log(`Anomaly Severity: ${lowQ.question.anomalySeverity || 'none'}`);
  if (lowQ.question.anomalySeverity === 'high' || lowQ.question.anomalySeverity === 'medium') {
    throw new Error(`Expected low/none severity, got '${lowQ.question.anomalySeverity}'`);
  }
  console.log('✓ Low-severity auto-classification verified!');

  // 4. Perform User Self-Escalation
  console.log('\n4. Elevating low-severity question via self-escalation...');
  const selfEscalated = await request(`/questions/${lowQ.question._id}/urgent`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  console.log(`Updated Anomaly Severity: ${selfEscalated.question.anomalySeverity}`);
  if (selfEscalated.question.anomalySeverity !== 'high') {
    throw new Error(`Expected severity 'high' after self-escalation, got '${selfEscalated.question.anomalySeverity}'`);
  }
  console.log('✓ User self-escalation verified!');

  // 5. Log in as admin
  console.log('\n5. Logging in as admin...');
  const adminAuth = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@quorafaq.com', password: 'admin123' }),
  });
  const adminToken = adminAuth.token;
  console.log('Logged in successfully. Token acquired.');

  // 6. Get anomalies list
  console.log('\n6. Fetching anomalies list from admin dashboard...');
  const anomaliesData = await request('/admin/anomalies?severity=high&status=unresolved', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`Found ${anomaliesData.anomalies.length} unresolved high anomalies.`);
  const testAnomaly = anomaliesData.anomalies.find(a => a._id === highQ.question._id);
  if (!testAnomaly) {
    throw new Error('Could not find our posted high-severity question in the admin anomalies list.');
  }
  console.log('✓ Anomalies listing and filters verified!');

  // 7. Resolve the anomaly
  console.log('\n7. Resolving anomaly from admin dashboard...');
  const resolvedData = await request(`/admin/anomalies/${highQ.question._id}/resolve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`Resolved Question Anomaly Severity: ${resolvedData.question.anomalySeverity}`);
  console.log(`Resolved: ${!!resolvedData.question.anomalyResolvedAt}`);
  if (!resolvedData.question.anomalyResolvedAt) {
    throw new Error('Expected anomalyResolvedAt to be set.');
  }
  console.log('✓ Admin anomaly resolution verified!');

  console.log('\n--- ALL ANOMALY DETECTION E2E API TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:');
  console.error(err);
  process.exit(1);
});
