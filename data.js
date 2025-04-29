// Attack types array
// const attackTypes = [""]; // Keep if needed, otherwise remove

let incidents = [];
let incidentsLoaded = false;
let incidentsLoadPromise = null;

// Function to load incidents data asynchronously
async function loadIncidents() {
  if (incidentsLoaded) return incidents;
  if (incidentsLoadPromise) return incidentsLoadPromise;

  incidentsLoadPromise = new Promise(async (resolve, reject) => {
    try {
      const response = await fetch("./incidents.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      incidents = await response.json();
      incidentsLoaded = true;
      incidentsLoadPromise = null;
      console.log(
        "Incidents JSON loaded successfully:",
        incidents.length,
        "records"
      );
      resolve(incidents);
    } catch (error) {
      console.error("Error loading incidents.json:", error);
      incidentsLoadPromise = null;
      reject(error);
    }
  });
  return incidentsLoadPromise;
}

// Export the loader function and the incidents array (once loaded)
export { loadIncidents, incidents };
