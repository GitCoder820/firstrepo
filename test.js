// Export CSV button (client-side builds CSV from loaded state)
const exportBtn = document.createElement('button');
exportBtn.textContent = 'Export All Data to CSV';
exportBtn.style.marginTop = '15px';
exportBtn.onclick = ()=>{
  let csv = 'Powerhouse,Feeder,Transformer,Pole,AccountID,AccountName,Phone,Remark\\n';
  state.data.powerhouses.forEach(ph=>{
    (ph.accounts||[]).forEach(f=>{
          if(f.id.length>0){
              csv+=\`\${f.powerhouse},\${f.feeder},\${f.transformer},\${f.pole},\${f.id},\${f.name},\${f.phone},"\\\${f.remark || ''}"\\n\`;
            };
          } else {
            csv+=\`\${pf.name},\${f.name},\${f.name},\${f.name}\n\`;
          }
        });
  });
  const blob = new Blob([csv],{type:'text/csv'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'powerhouse_data.csv';
  link.click();
};