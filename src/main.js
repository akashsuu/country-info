const API_KEY=import.meta.env.VITE_NASA_API_KEY;
const REST_API_KEY=import.meta.env.VITE_REST_COUNTRIES_API_KEY;

const input=document.querySelector("#countryInput");
const button=document.querySelector("#searchButton");
const result=document.querySelector("#result");

button.onclick=search;
input.onkeydown=e=>{if(e.key==="Enter")search()};

async function get(url,options={}){
 const r=await fetch(url,options);
 if(!r.ok)throw Error("HTTP "+r.status);
 return r.json();
}
async function safe(url,options={}){
 try{return await get(url,options)}
 catch(e){console.log("Failed:",url,e);return null}
}

function getCountyTime(timezone){
    const now=new Date();
    return new Intl.DateTimeFormat("en-US",{
        timeZone:"timezone",
        dateStyle:"full",
        timeStyle:"medium"
    }).format(now);
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

  const countyData=await safe(
    "https://api.restcountries.com/countries/v5?q="+
    encodeURIComponent(q),
    {
        Headers:{
        "Authorization":"Bearer"+REST_API_KEY
        }
    }
    );

 
  const county=countyData?.data?.objects?.[0];
  const timezone=county?.timezone?.[0]||"UTC";

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

  show(wiki,w,n,e,lat,lon,timezone);
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

function showMap(lat,lon,name){
    setTimeout(()=>{
        const old=document.querySelector("#countryMap");
        if(!old||typeof L==="undefined")return;

        const map=L.map("countryMap").setView([lat,lon],5);

        L.tileLayer("'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
            attribution:"$copy; openstreetMap contributors"
        }).addto(map);

        L.marker([lat,lon])
        .addTo(map)
        .bindPopup("<b>"+name+"</b>")
        .openPopup();
    },100);
}


function show(c,w,n,e,lat,lon,timezone,countryTime){
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

let events="No live events found for this country.";
if(e?.events?.length&&lat&&lon){
 const types=[
  "Wildfires",
  "Severe Storms",
  "Earthquakes",
  "Volcanoes",
  "Floods",
  "Sea and Lake Ice",
  "Landslides",
  "Dust and Haze"
 ];

 const found=[];

 for(const type of types){
  const match=e.events.find(x=>{
   const category=x.categories?.[0]?.title||"";
   const g=x.geometry?.[x.geometry.length-1];
   if(!g||g.type!=="Point"||!g.coordinates)return false;
   if(category!==type)return false;
   return distance(lat,lon,g.coordinates[1],g.coordinates[0])<=1800;
  });

  if(match)found.push(match);

  if(found.length>=6)break;
 }

 if(found.length){
  events=found.map(x=>{
   const category=x.categories?.[0]?.title||"Live Event";
   let icon="";

   if(category==="Wildfires");
   else if(category==="Severe Storms");
   else if(category==="Earthquakes");
   else if(category==="Volcanoes");
   else if(category==="Floods");
   else if(category==="Landslides");
   else if(category==="Dust and Haze");

   return`
   <div class="event">
    <b>${icon} ${x.title}</b>
    <br>
    ${category}
   </div>
   `;
  }).join("");
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

 <hr> 
  <h2>Local Time &date<h2>
  <table>
  <tr>
  <th>local zone<th>
  <td>${timezone}</td>
  </tr>
  <tr>
     <td>${new Intl.DateTimeFormat("en-US",{
        timeZone:timezone,
        weekday:"long",
        year:"numeric",
        month:"long",
        day:"numeric"
     }).format(new Date())}</td>
     </tr>
     <tr>
     <th>Local Time</th>
     <tf>${new Intl.DateTimeFormat("en-US",{
        timeZone:timezone,
        hour:"2-digit",
        minute:"2-digit",
        second:"2-digit"
     }).format(new Date())}</td>
     </tr>
     </table>

  <h2>Nature & Geography</h2>
  <p>
   <b>Coordinates:</b>
   ${lat||"Unavailable"},
   ${lon||"Unavailable"}
  </p>
  <h3>county Map</h3>
  <div id="countryMap" class="county-map"></div>
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
  <h2>Live Events</h2>
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

 showMap(lat,lon,c.title);
 }

