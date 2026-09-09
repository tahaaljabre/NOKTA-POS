const { start } = require('./support.cjs');
(async () => {
  const { api, db, assert, close } = await start();
  try {
    let response = await api('/api/attendance/employees', 'POST', { employee_code: 'HR-001', name: 'موظف حضور', name_en: 'Attendance Staff' });
    assert.equal(response.status, 201);
    const employeeId = response.data.id;
    response = await api('/api/attendance/records', 'POST', { hr_employee_id: employeeId, attendance_date: '2026-09-09', check_in: '08:00', check_out: '17:00' });
    assert.equal(response.status, 201);
    response = await api('/api/attendance/records?date=2026-09-09');
    assert.equal(response.data.records[0].check_in, '08:00');
    response = await api('/api/attendance/devices', 'POST', { name: 'Device A', provider: 'generic', host: '192.168.1.10' });
    assert.equal(response.status, 201);
    response = await api(`/api/attendance/employees/${employeeId}`, 'PUT', { department: 'Operations', job_title: 'Supervisor' });
    assert.equal(response.status, 200);
    response = await api(`/api/attendance/employees/${employeeId}`, 'DELETE');
    assert.equal(response.status, 200);
    assert.equal(db.prepare('SELECT active FROM hr_employees WHERE id=?').get(employeeId).active, 0);
    assert.equal(db.prepare('SELECT count(*) n FROM hr_employees').get().n, 1);
    console.log('PASS 27: separate HR employees, attendance records, and biometric device registry');
  } finally { await close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
