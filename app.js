// app.js
// Single-file Node.js app that serves the whole frontend and connects to MongoDB.
// Usage: node app.js

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const PORT = 3000;

// ----------------- Configuration -----------------
const MONGO_URL = "mongodb+srv://rjvermasdomm_db_user:wClS1ErdUFWNNkuq@cluster0.mwjhhhd.mongodb.net/?retryWrites=true&w=majority";

// ----------------- Mongoose Models -----------------
mongoose.set('strictQuery', false);
mongoose.connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => {
    console.error('Mongo connection error:', err);
    process.exit(1);
  });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: String,
  role: String,
  powerhouse: String
});
const User = mongoose.model('User', userSchema);

const poleSchema = new mongoose.Schema({ name: String }, { _id: false });
const transformerSchema = new mongoose.Schema({
  name: String,
  poles: [poleSchema]
}, { _id: false });
const feederSchema = new mongoose.Schema({
  name: String,
  transformers: [transformerSchema]
}, { _id: false });

const accountSchema = new mongoose.Schema({
  id: String,
  name: String,
  phone: String,
  powerhouse: String,
  feeder: String,
  transformer: String,
  pole: String,
  remark: String
}, { _id: false });

const powerhouseSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  feeders: [feederSchema],
  accounts: [accountSchema]
});
const Powerhouse = mongoose.model('Powerhouse', powerhouseSchema);

// Ensure default admin exists on startup
async function ensureAdmin() {
  const admin = await User.findOne({ username: 'admin' });
  if (!admin) {
    await User.create({ username: 'admin', password: 'admin123', role: 'admin', powerhouse: null });
    console.log('Default admin user created: admin / admin123');
  }
}
ensureAdmin();

// ----------------- Middleware -----------------
app.use(bodyParser.json());

// Serve the single HTML page
app.get('/', (req, res) => {
  res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Powerhouse Management System</title>
<style>
body{font-family:Arial,sans-serif;margin:0;padding:0;background:#f0f2f5;}
header{background:linear-gradient(90deg,#4CAF50,#81C784);color:white;padding:20px;text-align:center;}
.container{display:flex;flex-wrap:wrap;padding:20px;}
.card{background:white;padding:20px;margin:10px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,0.2);flex:1 1 300px;}
input,select,button,textarea{display:block;width:100%;margin:8px 0;padding:10px;border-radius:5px;border:1px solid #ccc;box-sizing:border-box;}
button{background-color:#4CAF50;color:white;border:none;cursor:pointer;}
button:hover{opacity:0.85;}
h3,h4{margin-top:15px;color:#2e7d32;}
.smallBtn{padding:4px 8px;font-size:12px;margin-left:5px;display:inline-block;}
.btnContainer{display:inline-flex;}
@media(max-width:600px){.container{flex-direction:column;}}
</style>
</head>
<body>
<header><h1>Powerhouse Management System</h1></header>

<div class="container">
  <!-- Login Form -->
  <div class="card" id="loginContainer">
    <h2>Login</h2>
    <input type="text" id="username" placeholder="Username">
    <input type="password" id="password" placeholder="Password">
    <button id="loginBtn">Login</button>
    <div id="loginMsg" style="color:red;"></div>
  </div>

  <!-- Dashboard (hidden initially) -->
  <div class="card" id="dashboard" style="display:none;">
    
    <!-- Admin Panel -->
    <div id="adminSection" style="display:none;">
      <h3>Admin Panel</h3>
      <h4>Add Powerhouse & Assign User</h4>
      <input type="text" id="newPowerhouseName" placeholder="Powerhouse Name">
      <input type="text" id="newPowerhouseUser" placeholder="Assign Username">
      <input type="password" id="newPowerhousePass" placeholder="Assign Password">
      <button id="addPowerhouseBtn">Add Powerhouse</button>
      <div id="powerhouseList"></div>
      <hr>
      <h4>Hierarchy Management</h4>
      <select id="selectPowerhouse"><option value="">Select Powerhouse</option></select>
      <div id="hierarchySection"></div>
      <hr>
      <div id="userListDiv"></div>
      <button onclick="window.location.href='/api/exportAccounts'">
  Download CSV
</button>
    </div>

    <!-- User Panel -->
    <div id="userSection" style="display:none;">
      <h3>User Panel</h3>
      <div id="userAccountSection">
        <input type="text" id="accountId" placeholder="Account ID">
        <input type="text" id="accountName" placeholder="Account Name">
        <input type="text" id="accountPhone" placeholder="Account Phone">
        <textarea id="accountRemark" placeholder="Remark (optional)"></textarea>
        <select id="userFeederSelect"><option value="">Select Feeder</option></select>
        <select id="userTransformerSelect"><option value="">Select Transformer</option></select>
        <select id="userPoleSelect"><option value="">Select Pole</option></select>
        <button id="addAccountBtn">Add/Update Account</button>
      </div>
      <hr>
      <h4>Search Account</h4>
      <input type="text" id="searchAccountId" placeholder="Search by Account ID">
      <button id="searchAccountBtn">Search</button>
      <div id="searchResult"></div>
    </div>

  </div>
</div>

<script>
/*
  Client-side code: communicates with server endpoints to load/save data.
  We keep an in-memory state object similar to your original localStorage state,
  but every change is saved to server via /api/saveAll.
*/

// --- GLOBAL STATE (client-side) ---
let GLOBAL_USERS = [];       // loaded from server
let state = { user: null, data: { powerhouses: [], accounts: [] } };

// DOM Elements
const loginContainer = document.getElementById('loginContainer');
const dashboard = document.getElementById('dashboard');
const adminSection = document.getElementById('adminSection');
const userSection = document.getElementById('userSection');
const loginBtn = document.getElementById('loginBtn');
const loginMsg = document.getElementById('loginMsg');
const addPowerhouseBtn = document.getElementById('addPowerhouseBtn');
const selectPowerhouse = document.getElementById('selectPowerhouse');
const hierarchySection = document.getElementById('hierarchySection');

// Load data from server on start
async function loadFromServer(){
  try {
    const res = await fetch('/api/loadAll');
    const json = await res.json();
    GLOBAL_USERS = json.users || [];
    state.data.powerhouses = json.powerhouses || [];
    state.data.accounts = [];
    // collect accounts from powerhouses
    state.data.powerhouses.forEach(ph => {
      if(ph.accounts && Array.isArray(ph.accounts)) ph.accounts.forEach(a => state.data.accounts.push(a));
    });
    renderPowerhouses();
    renderUsers();
  } catch(err){
    console.error('Failed to load:', err);
    alert('Failed to connect to server. Check console for details.');
  }
}

// Save all data to server: we send users and powerhouses arrays
async function saveData(){
  try {
    // make sure accounts in master state are assigned into corresponding powerhouse documents
    // to be safe, we rebuild powerhouses[].accounts from state.data.accounts
    state.data.powerhouses.forEach(ph => ph.accounts = []);
    state.data.accounts.forEach(acc => {
      const ph = state.data.powerhouses.find(p => p.name === acc.powerhouse);
      if(ph){
        ph.accounts = ph.accounts || [];
        ph.accounts.push(acc);
      }
    });

    await fetch('/api/saveAll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: GLOBAL_USERS, powerhouses: state.data.powerhouses })
    });
  } catch(err){
    console.error('Save failed:', err);
    alert('Save failed. Check console.');
  }
}

// --- LOGIN FUNCTION ---
loginBtn.onclick = async ()=>{
  const u = document.getElementById('username').value.trim();
  const p = document.getElementById('password').value;
  if(!u || !p){ loginMsg.innerText = 'Enter credentials'; return; }
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username: u, password: p })
    });
    const js = await res.json();
    if(js.success){
      const foundUser = js.user;
      state.user = {...foundUser};
      loginContainer.style.display = 'none';
      dashboard.style.display = 'block';
      if(foundUser.role==='admin'){
        adminSection.style.display='block';
        userSection.style.display='none';
      } else {
        adminSection.style.display='none';
        userSection.style.display='block';
        renderUserFeederDropdown();
      }
      renderPowerhouses();
      renderUsers();
      loginMsg.innerText = '';
    } else {
      loginMsg.innerText = js.msg || 'Invalid username or password';
    }
  } catch(err){
    console.error('Login error', err);
    loginMsg.innerText = 'Login error (see console)';
  }
};

// --- ADD POWERHOUSE FUNCTION ---
addPowerhouseBtn.onclick = async ()=>{
  const name = document.getElementById('newPowerhouseName').value.trim();
  const uname = document.getElementById('newPowerhouseUser').value.trim();
  const upass = document.getElementById('newPowerhousePass').value.trim();
  if(!name||!uname||!upass){ alert('Fill all fields'); return; }

  // Update client state
  state.data.powerhouses.push({ name: name, feeders: [], accounts: [] });
  GLOBAL_USERS.push({ username: uname, password: upass, role: 'user', powerhouse: name });

  // clear inputs
  document.getElementById('newPowerhouseName').value='';
  document.getElementById('newPowerhouseUser').value='';
  document.getElementById('newPowerhousePass').value='';

  await saveData();
  await loadFromServer(); // reload authoritative data
};

// --- RENDER POWERHOUSES IN ADMIN PANEL ---
function renderPowerhouses(){
  const powerhouseList = document.getElementById('powerhouseList');
  powerhouseList.innerHTML='';
  selectPowerhouse.innerHTML='<option value="">Select Powerhouse</option>';

  state.data.powerhouses.forEach((ph, idx)=>{
    const div = document.createElement('div');
    div.style.marginBottom='10px';
    div.innerHTML = \`<b>\${ph.name}</b>\`;

    const delBtn = document.createElement('button'); delBtn.className='smallBtn'; delBtn.textContent='Delete';
    delBtn.onclick = async ()=>{ 
      if(!confirm('Delete this powerhouse and its accounts?')) return;
      // remove from client state
      state.data.powerhouses.splice(idx,1);
      // remove users with that powerhouse
      GLOBAL_USERS = GLOBAL_USERS.filter(u => u.powerhouse !== ph.name);
      await saveData();
      await loadFromServer();
    };

    const editBtn = document.createElement('button'); editBtn.className='smallBtn'; editBtn.textContent='Edit';
    editBtn.onclick = async ()=>{ 
      const oldName = ph.name;
      const newName = prompt("Enter new powerhouse name", ph.name);
      if(newName && newName.trim()){
        // update name in powerhouses and users and accounts
        ph.name = newName.trim();
        GLOBAL_USERS.forEach(u=>{ if(u.powerhouse===oldName) u.powerhouse=newName.trim(); });
        state.data.accounts.forEach(a=>{ if(a.powerhouse===oldName) a.powerhouse=newName.trim(); });
        await saveData();
        await loadFromServer();
      }
    };

    const btnContainer = document.createElement('div'); btnContainer.className='btnContainer';
    btnContainer.appendChild(editBtn); btnContainer.appendChild(delBtn);
    div.appendChild(btnContainer);
    powerhouseList.appendChild(div);

    const opt = document.createElement('option'); opt.value=idx; opt.textContent=ph.name;
    selectPowerhouse.appendChild(opt);
  });

  renderHierarchySection();
}

// --- RENDER HIERARCHY SECTION ---
function renderHierarchySection(){
  hierarchySection.innerHTML='';
  const phIdx = selectPowerhouse.value;
  if(phIdx==='') return;

  const ph = state.data.powerhouses[phIdx];
  if(!ph) return;

  // Add Feeder Section
  const feederDiv = document.createElement('div');
  feederDiv.innerHTML = \`<h4>Feeders</h4>
    <input type="text" id="newFeederName" placeholder="Feeder Name">
    <button id="addFeederBtn">Add Feeder</button>\`;
  hierarchySection.appendChild(feederDiv);

  const addFeederBtn = feederDiv.querySelector('#addFeederBtn');
  const newFeederName = feederDiv.querySelector('#newFeederName');

  addFeederBtn.onclick = async ()=>{
    if(!newFeederName.value.trim()) return;
    ph.feeders.push({ name: newFeederName.value.trim(), transformers: [] });
    newFeederName.value='';
    await saveData();
    await loadFromServer();
    renderHierarchySection();
  };

  // Render Feeders
  ph.feeders.forEach((f, fIdx)=>{
    const fDiv = document.createElement('div'); fDiv.style.marginLeft='20px';
    fDiv.innerHTML = \`<b>\${f.name}</b>\`;

    const delBtn = document.createElement('button'); delBtn.className='smallBtn'; delBtn.textContent='Delete';
    delBtn.onclick = async ()=>{ ph.feeders.splice(fIdx,1); await saveData(); await loadFromServer(); renderHierarchySection(); };
    const editBtn = document.createElement('button'); editBtn.className='smallBtn'; editBtn.textContent='Edit';
    editBtn.onclick = async ()=>{ const newName=prompt("Enter new feeder name", f.name); if(newName){ f.name=newName; await saveData(); await loadFromServer(); renderHierarchySection(); } };
    const btnContainer = document.createElement('div'); btnContainer.className='btnContainer'; btnContainer.appendChild(editBtn); btnContainer.appendChild(delBtn);
    fDiv.appendChild(btnContainer);

    // Add Transformer Section
    const tDiv = document.createElement('div'); tDiv.style.marginLeft='20px';
    tDiv.innerHTML = \`<input type="text" placeholder="Transformer Name" class="newTransformer">
                      <button class="addTransformerBtn">Add Transformer</button>\`;
    fDiv.appendChild(tDiv);

    const addTransformerBtn = tDiv.querySelector('.addTransformerBtn');
    const newTransformerInput = tDiv.querySelector('.newTransformer');
    addTransformerBtn.onclick = async ()=>{
      if(!newTransformerInput.value.trim()) return;
      f.transformers.push({ name: newTransformerInput.value.trim(), poles: [] });
      newTransformerInput.value='';
      await saveData();
      await loadFromServer();
      renderHierarchySection();
    };

    // Render Transformers
    f.transformers.forEach((t, tIdx)=>{
      const tItem = document.createElement('div'); tItem.style.marginLeft='20px';
      tItem.innerHTML = \`<b>\${t.name}</b>\`;

      const delTBtn = document.createElement('button'); delTBtn.className='smallBtn'; delTBtn.textContent='Delete';
      delTBtn.onclick = async ()=>{ f.transformers.splice(tIdx,1); await saveData(); await loadFromServer(); renderHierarchySection(); };
      const editTBtn = document.createElement('button'); editTBtn.className='smallBtn'; editTBtn.textContent='Edit';
      editTBtn.onclick = async ()=>{ const newName=prompt("Enter new transformer name", t.name); if(newName){ t.name=newName; await saveData(); await loadFromServer(); renderHierarchySection(); } };
      const btnContainerT = document.createElement('div'); btnContainerT.className='btnContainer'; btnContainerT.appendChild(editTBtn); btnContainerT.appendChild(delTBtn);
      tItem.appendChild(btnContainerT);

      // Add Poles Section
      const pDiv = document.createElement('div'); pDiv.style.marginLeft='20px';
      pDiv.innerHTML = \`<input type="text" placeholder="Pole Name" class="newPole">
                        <button class="addPoleBtn">Add Pole</button>\`;
      tItem.appendChild(pDiv);

      const addPoleBtn = pDiv.querySelector('.addPoleBtn');
      const newPoleInput = pDiv.querySelector('.newPole');
      addPoleBtn.onclick = async ()=>{
        if(!newPoleInput.value.trim()) return;
        t.poles.push({ name: newPoleInput.value.trim() });
        newPoleInput.value='';
        await saveData();
        await loadFromServer();
        renderHierarchySection();
      };

      // Render Poles
      t.poles.forEach((p, pIdx)=>{
        const pItem = document.createElement('div'); pItem.style.marginLeft='20px';
        pItem.innerHTML = \`\${p.name} \`;
        const delPBtn = document.createElement('button'); delPBtn.className='smallBtn'; delPBtn.textContent='Delete';
        delPBtn.onclick = async ()=>{ t.poles.splice(pIdx,1); await saveData(); await loadFromServer(); renderHierarchySection(); };
        const editPBtn = document.createElement('button'); editPBtn.className='smallBtn'; editPBtn.textContent='Edit';
        editPBtn.onclick = async ()=>{ const newName=prompt("Enter new pole name",p.name); if(newName){ p.name=newName; await saveData(); await loadFromServer(); renderHierarchySection(); } };
        const btnContainerP = document.createElement('div'); btnContainerP.className='btnContainer'; btnContainerP.appendChild(editPBtn); btnContainerP.appendChild(delPBtn);
        pItem.appendChild(btnContainerP);
        tItem.appendChild(pItem);
      });

      tDiv.appendChild(tItem);
    });

    hierarchySection.appendChild(fDiv);
  });
}

// Update hierarchy when a new powerhouse is selected
selectPowerhouse.onchange = renderHierarchySection;

// ---------------- User-side elements/logic ----------------
const userFeederSelect = document.getElementById('userFeederSelect');
const userTransformerSelect = document.getElementById('userTransformerSelect');
const userPoleSelect = document.getElementById('userPoleSelect');
const accountId = document.getElementById('accountId');
const accountName = document.getElementById('accountName');
const accountPhone = document.getElementById('accountPhone');
const accountRemark = document.getElementById('accountRemark');
const addAccountBtn = document.getElementById('addAccountBtn');
const searchAccountId = document.getElementById('searchAccountId');
const searchAccountBtn = document.getElementById('searchAccountBtn');
const searchResult = document.getElementById('searchResult');

function renderUserFeederDropdown(){
  if(state.user && state.user.role==='user'){
    const ph = state.data.powerhouses.find(p => p.name === state.user.powerhouse);
    if(!ph) return;

    userFeederSelect.innerHTML='<option value="">Select Feeder</option>';
    ph.feeders.forEach((f, idx)=>{ 
      const opt = document.createElement('option'); 
      opt.value = idx; 
      opt.textContent = f.name; 
      userFeederSelect.appendChild(opt); 
    });

    userTransformerSelect.innerHTML='<option value="">Select Transformer</option>';
    userPoleSelect.innerHTML='<option value="">Select Pole</option>';
  }
}

// Update Transformers when Feeder changes
userFeederSelect.onchange = ()=>{
  const ph = state.data.powerhouses.find(p => p.name === state.user.powerhouse);
  const f = ph.feeders[userFeederSelect.value];
  userTransformerSelect.innerHTML='<option value="">Select Transformer</option>';
  userPoleSelect.innerHTML='<option value="">Select Pole</option>';
  if(f) f.transformers.forEach((t, idx)=>{
    const opt = document.createElement('option'); opt.value=idx; opt.textContent=t.name;
    userTransformerSelect.appendChild(opt);
  });
};

// Update Poles when Transformer changes
userTransformerSelect.onchange = ()=>{
  const ph = state.data.powerhouses.find(p => p.name === state.user.powerhouse);
  const f = ph.feeders[userFeederSelect.value];
  const t = f && f.transformers ? f.transformers[userTransformerSelect.value] : null;
  userPoleSelect.innerHTML='<option value="">Select Pole</option>';
  if(t) t.poles.forEach((p, idx)=>{
    const opt = document.createElement('option'); opt.value=idx; opt.textContent=p.name;
    userPoleSelect.appendChild(opt);
  });
};

// Add/Update Account
addAccountBtn.onclick = async ()=>{
  const ph = state.data.powerhouses.find(p => p.name === state.user.powerhouse);
  const f = ph && ph.feeders[userFeederSelect.value];
  const t = f && f.transformers[userTransformerSelect.value];
  const p = t && t.poles[userPoleSelect.value];

  if(!accountId.value.trim() || !accountName.value.trim() || !accountPhone.value.trim() || !f || !t || !p){
    alert('Fill all fields and select hierarchy');
    return;
  }

  const existing = state.data.accounts.find(a=>a.id===accountId.value.trim() && a.powerhouse===ph.name);

  if(existing){
    const updateConfirm = confirm('Duplicate Account ID found. Do you want to update the existing record?');
    if(!updateConfirm) return;
    existing.name = accountName.value.trim();
    existing.phone = accountPhone.value.trim();
    existing.feeder = f.name;
    existing.transformer = t.name;
    existing.pole = p.name;
    existing.remark = accountRemark.value.trim();
    alert('Account updated successfully');
  } else {
    state.data.accounts.push({
      id: accountId.value.trim(),
      name: accountName.value.trim(),
      phone: accountPhone.value.trim(),
      powerhouse: ph.name,
      feeder: f.name,
      transformer: t.name,
      pole: p.name,
      remark: accountRemark.value.trim()
    });
    alert('Account added successfully');
  }

  // Clear inputs
  accountId.value=''; accountName.value=''; accountPhone.value=''; accountRemark.value='';
  userFeederSelect.value=''; userTransformerSelect.innerHTML='<option value="">Select Transformer</option>'; userPoleSelect.innerHTML='<option value="">Select Pole</option>';
  await saveData();
  await loadFromServer();
};

// Search Account
searchAccountBtn.onclick = async ()=>{
  const id = searchAccountId.value.trim();
  if(!id || !state.user || !state.user.powerhouse) { searchResult.innerText='Enter ID and ensure you are logged in as a user'; return; }
  try {
    const res = await fetch(\`/api/searchAccount/\${encodeURIComponent(state.user.powerhouse)}/\${encodeURIComponent(id)}\`);
    const js = await res.json();
    if(js.found){
      const acc = js.account;
      searchResult.innerHTML = \`<b>ID:</b> \${acc.id}<br>
                            <b>Name:</b> \${acc.name}<br>
                            <b>Phone:</b> \${acc.phone}<br>
                            <b>Feeder:</b> \${acc.feeder}<br>
                            <b>Transformer:</b> \${acc.transformer}<br>
                            <b>Pole:</b> \${acc.pole}<br>
                            <b>Remark:</b> \${acc.remark || ''}\`;
    } else {
      searchResult.innerText = 'Account not found';
    }
  } catch(err){
    console.error('Search error', err);
    searchResult.innerText = 'Search error (see console)';
  }
};

// Export CSV button (client-side builds CSV from loaded state)


const exportBtn = document.createElement('button');
exportBtn.textContent = 'dont click';
exportBtn.style.display = 'none';
exportBtn.onclick = ()=>{
  let csv = 'Powerhouse,Feeder,Transformer,Pole,AccountID,AccountName,Phone,Remark\\n';
  state.data.powerhouses.forEach(ph=>{
    (ph.feeders||[]).forEach(f=>{
      (f.transformers||[]).forEach(t=>{
        (t.poles||[]).forEach(p=>{
          const accounts = (ph.accounts||[]).filter(a => 
            a.powerhouse===ph.name && a.feeder===f.name && a.transformer===t.name && a.pole===p.name
          );
          if(accounts.length>0){
            accounts.forEach(acc=>{
              csv+=\`\${ph.name},\${f.name},\${t.name},\${p.name},\${acc.id},\${acc.name},\${acc.phone},"\\\${acc.remark || ''}"\\n\`;
            });
          } else {
            csv+=\`\${ph.name},\${f.name},\${t.name},\${p.name},,,,\n\`;
          }
        });
      });
    });
  });
  const blob = new Blob([csv],{type:'text/csv'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'powerhouse_data.csv';
  link.click();
};

function renderUsers(){
  const userListDiv = document.getElementById('userListDiv');
  userListDiv.innerHTML='<h4>Manage Users</h4>';
  state.data.powerhouses.forEach(ph=>{
    const users = GLOBAL_USERS.filter(u=>u.role==='user' && u.powerhouse===ph.name);
    if(users.length>0){
      const phDiv=document.createElement('div'); phDiv.innerHTML=\`<b>Powerhouse: \${ph.name}</b>\`;
      users.forEach(u=>{
        const uDiv=document.createElement('div'); uDiv.style.marginLeft='20px';
        uDiv.innerHTML=\`\${u.username} \`;
        const delBtn=document.createElement('button'); delBtn.className='smallBtn'; delBtn.textContent='Delete';
        delBtn.onclick = async ()=>{
          if(!confirm('Delete user?')) return;
          GLOBAL_USERS = GLOBAL_USERS.filter(g=>!(g.username===u.username && g.powerhouse===u.powerhouse));
          await saveData();
          await loadFromServer();
        };
        const editBtn=document.createElement('button'); editBtn.className='smallBtn'; editBtn.textContent='Edit';
        editBtn.onclick = async ()=>{
          const newPass=prompt("Enter new password",u.password);
          if(newPass){
            const idx=GLOBAL_USERS.findIndex(g=>g.username===u.username && g.powerhouse===u.powerhouse);
            if(idx!==-1){ GLOBAL_USERS[idx].password=newPass; await saveData(); await loadFromServer(); }
          }
        };
        const btnContainer=document.createElement('div'); btnContainer.className='btnContainer';
        btnContainer.appendChild(editBtn); btnContainer.appendChild(delBtn); uDiv.appendChild(btnContainer);
        phDiv.appendChild(uDiv);
      });
      userListDiv.appendChild(phDiv);
    }
  });
}

// Responsive font
function adjustFont(){ if(window.innerWidth<600){ document.body.style.fontSize='14px'; } else { document.body.style.fontSize='16px'; } }
window.addEventListener('resize',adjustFont);
adjustFont();

// Initial load
document.addEventListener('DOMContentLoaded', async ()=>{ await loadFromServer(); adminSection.appendChild(exportBtn); });
</script>

</body>
</html>`);
});

// ----------------- API Endpoints -----------------

// Load all users and powerhouses

// ----------------- EXPORT ACCOUNTS TO CSV -----------------
app.get('/api/exportAccounts', async (req, res) => {
  try {
    const powerhouses = await Powerhouse.find({}).lean();

    let csv = 'Powerhouse,Feeder,Transformer,Pole,AccountID,AccountName,Phone,Remark\n';

    powerhouses.forEach(ph => {
      (ph.accounts || []).forEach(acc => {
        csv += `${acc.powerhouse || ph.name},${acc.feeder || ''},${acc.transformer || ''},${acc.pole || ''},${acc.id || ''},${acc.name || ''},${acc.phone || ''},"${acc.remark || ''}"\n`;
      });
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="accounts.csv"');
    res.send(csv);
  } catch (err) {
    console.error('CSV export failed:', err);
    res.status(500).send('Error generating CSV file');
  }
});


app.get('/api/loadAll', async (req, res) => {
  try {
    const users = await User.find({}).sort({ username: 1 }).lean();
    const powerhouses = await Powerhouse.find({}).sort({ name: 1 }).lean();
    res.json({ users, powerhouses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'load failed' });
  }
});

// Save all users and powerhouses (replace collections)
app.post('/api/saveAll', async (req, res) => {
  try {
    const { users, powerhouses } = req.body;
    if (!Array.isArray(users) || !Array.isArray(powerhouses)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Replace users collection
    await User.deleteMany({});
    if (users.length) {
      // ensure unique usernames: Mongo will enforce unique but we prevent server error by filtering duplicates
      const uniqueUsers = [];
      const seen = new Set();
      users.forEach(u => {
        if (u.username && !seen.has(u.username)) {
          seen.add(u.username);
          uniqueUsers.push(u);
        }
      });
      if (uniqueUsers.length) await User.insertMany(uniqueUsers);
    }

    // Replace powerhouses collection
    await Powerhouse.deleteMany({});
    if (powerhouses.length) {
      // Keep only necessary fields and ensure array structure
      const cleaned = powerhouses.map(ph => ({
        name: ph.name,
        feeders: ph.feeders || [],
        accounts: ph.accounts || []
      }));
      if (cleaned.length) await Powerhouse.insertMany(cleaned);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('saveAll error', err);
    res.status(500).json({ error: 'save failed' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, msg: 'Missing credentials' });

    const user = await User.findOne({ username: username }).lean();
    if (!user) return res.json({ success: false, msg: 'Invalid credentials' });
    if (user.password !== password) return res.json({ success: false, msg: 'Invalid credentials' });

    // return user doc (without sensitive fields beyond password which we keep as-is here)
    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, msg: 'login error' });
  }
});

// Search account by powerhouse & id
app.get('/api/searchAccount/:powerhouse/:id', async (req, res) => {
  try {
    const phname = req.params.powerhouse;
    const id = req.params.id;
    if (!phname || !id) return res.json({ found: false });

    const ph = await Powerhouse.findOne({ name: phname }).lean();
    if (!ph || !ph.accounts) return res.json({ found: false });
    const acc = ph.accounts.find(a => a.id === id);
    if (!acc) return res.json({ found: false });
    res.json({ found: true, account: acc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ found: false });
  }
});

// Basic CRUD helpers (not used by client heavily, but available)
app.get('/api/users', async (req, res) => {
  const users = await User.find({}).lean();
  res.json(users);
});

app.get('/api/powerhouses', async (req, res) => {
  const powerhouses = await Powerhouse.find({}).lean();
  res.json(powerhouses);
});

// Start server
app.listen(PORT, () => {
  console.log('Server running at http://localhost:' + PORT);
});
