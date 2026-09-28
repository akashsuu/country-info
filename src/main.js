const API_KEY=import.meta.env.VITE_NASA_API_KEY;

const input=document.querySelector("#countryInput");
const button=document.querySelector("#searchButton");
const result=document.querySelector("#result");

button.onclick=search;
input.onkeydown=e=>{if(e.key==="Enter")search()};
async function get(url){
 const r=await fetch(url);
 if(!r.ok)throw Error("HTTP "+r.status);
 return r.json();
}
async function safe(url){
 try{return await get(url)}
 catch(e){console.log("Failed:",url,e);return null}
}
async function search(){
 const q=input.value.trim();
 if(!q){
  result.innerHTML="<p>Please enter a country name.</p>";
  return;
 }
 result.innerHTML="<p>Loading...</p>";
 try{
  const wiki=await get(
   "https://en.wikipedia.org/api/rest_v1/page/summary/"+
   encodeURIComponent(q)
  );

  if(!wiki.title)
   throw Error("Country not found");
  const lat=wiki.coordinates?.lat||0;
  const lon=wiki.coordinates?.lon||0;
  const weather=lat&&lon?safe(
   `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7&timezone=auto`
  ):null;

  const nasa=safe(
   "https://images-api.nasa.gov/search?q="+
   encodeURIComponent(q+" space")+
   "&media_type=image"
  );

  const events=API_KEY?safe(
   "https://eonet.gsfc.nasa.gov/api/v3/events?status=open"
  ):null;
  const [w,n,e]=await Promise.all([
   weather,nasa,events
  ]);
  show(wiki,w,n,e,lat,lon);
 }catch(err){
  console.error(err);
  result.innerHTML=`
   <h2>Country not found</h2>
   <p>${err.message}</p>
  `;
 }
}
function distance(lat1,lon1,lat2,lon2){
 const R=6371;
 const dLat=(lat2-lat1)*Math.PI/180;
 const dLon=(lon2-lon1)*Math.PI/180;
 const a=Math.sin(dLat/2)**2+
 Math.cos(lat1*Math.PI/180)*
 Math.cos(lat2*Math.PI/180)*
 Math.sin(dLon/2)**2;
 return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function show(c,w,n,e,lat,lon){
 const image=c.thumbnail?.source||"";
 let weatherHTML="<p>Weather unavailable.</p>";
 if(w?.current){
  weatherHTML=`
   <table>
    <tr>
     <th>Temperature</th>
     <td>${w.current.temperature_2m}°C</td>
    </tr>
    <tr>
     <th>Feels Like</th>
     <td>${w.current.apparent_temperature}°C</td>
    </tr>
    <tr>
     <th>Humidity</th>
     <td>${w.current.relative_humidity_2m}%</td>
    </tr>
    <tr>
     <th>Wind</th>
     <td>${w.current.wind_speed_10m} km/h</td>
    </tr>
   </table>
  `;

 }

 let forecast="";
 if(w?.daily){
  forecast=w.daily.time.map((d,i)=>`
   <tr>
    <td>${d}</td>
    <td>${w.daily.temperature_2m_min[i]}°C</td>
    <td>${w.daily.temperature_2m_max[i]}°C</td>
    <td>${w.daily.precipitation_sum[i]} mm</td>
   </tr>
  `).join("");

 }else{
  forecast=`
   <tr>
    <td colspan="4">
     Forecast unavailable.
    </td>
   </tr>
  `;
 }

let events="No active NASA events found for this country."; 
if(e?.events?.length){ 
 const country=c.title.toLowerCase(); 
 const aliases={ 
  "united states":["united states","usa","us"], 
  "united kingdom":["united kingdom","uk"], 
  "russia":["russia","russian federation"], 
  "south korea":["south korea","republic of korea"], 
  "north korea":["north korea","democratic people's republic of korea"], 
  "myanmar":["myanmar","burma"], 
  "iran":["iran","islamic republic of iran"], 
  "vietnam":["vietnam"], 
  "laos":["laos"], 
  "bolivia":["bolivia","plurinational state of bolivia"], 
  "tanzania":["tanzania","united republic of tanzania"], 
  "venezuela":["venezuela","bolivarian republic of venezuela"] 
 }; 
 
 const names=aliases[country]||[country]; 
 
 const nearby=e.events.filter(x=>{ 
  const text=((x.title||"")+" "+(x.description||"")).toLowerCase(); 
  return names.some(name=>text.includes(name)); 
 }).slice(0,10); 
 
 if(nearby.length){ 
  events=nearby.map(x=>` 
   <div class="event"> 
    <b>${x.title}</b> 
    <br> 
    ${x.categories?.[0]?.title||"Natural event"} 
   </div> 
  `).join(""); 
 } 
}

 let nasa="NASA images unavailable.";
 if(n?.collection?.items?.length){
  nasa=`
   <div class="space-gallery">
    ${n.collection.items.slice(0,6).map(x=>{
     const d=x.data?.[0];
     const p=x.links?.find(l=>l.render==="image")?.href;
     return p?`
      <figure>
       <img class="space-image" src="${p}" alt="${d?.title||"NASA Space Image"}">
       <figcaption>
        <b>${d?.title||"NASA Space Image"}</b>
        <br>
        ${d?.description?.slice(0,200)||""}
       </figcaption>
      </figure>
     `:"";
    }).join("")}
   </div>
  `;
 }

let satellite="NASA satellite imagery unavailable.";
if(lat&&lon){
 const satelliteURL=`https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?service=WMS&request=GetMap&version=1.3.0&layers=MODIS_Terra_CorrectedReflectance_TrueColor&styles=&format=image/jpeg&transparent=false&width=1000&height=650&crs=CRS:84&bbox=${lon-5},${lat-5},${lon+5},${lat+5}`;
 satellite=`
  <h3>NASA Satellite View</h3>
  <img class="satellite-image" src="${satelliteURL}" alt="NASA satellite imagery of ${c.title}" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
  <p style="display:none">NASA satellite image is currently unavailable.</p>
  <p>Satellite imagery centered on ${c.title}.</p>
 `;
}

 result.innerHTML=`
 <article>
  <header>
   ${image?
    `<img class="flag" src="${image}">`
    :""
   }
   <div>
    <h1>${c.title}</h1>
    <p>Country Explorer</p>
   </div>
  </header>
  <hr>
  <h2>Country Information</h2>
  <p>
   ${c.extract||"No country description available."}
  </p>
  <hr>
  <h2>Nature & Geography</h2>
  <p>
   <b>Coordinates:</b>
   ${lat||"Unavailable"},
   ${lon||"Unavailable"}
  </p>
  <p>
   Detailed geographical information is
   provided by the country article.
  </p>
  <hr>
  <h2>Climate & Weather</h2>
  ${weatherHTML}
  <h3>7 Day Forecast</h3>
  <table>
   <tr>
    <th>Date</th>
    <th>Minimum</th>
    <th>Maximum</th>
    <th>Rain</th>
   </tr>
   ${forecast}
  </table>
  <hr>
  <h2>Natural Disasters & Events</h2>
  ${events}
  <hr>
  <h2>Country Images</h2>
  ${image?
   `<img class="country-image" src="${image}">`
   :"<p>No image available.</p>"
  }
  <hr>
  <h2>NASA Satellite Imagery</h2>
  ${satellite}
  <hr>
  <h2>NASA Space</h2>
  ${nasa}
 </article>
 `;
}
