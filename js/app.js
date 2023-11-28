// app.js is the main JavaScript file for this project
// This file contains the code that fetches the data from the API and creates the CSV file

// Global variable to control the fetching process
let isFetching = false; // Flag to control the fetching process
let isError = false; // Flag to control the UI reset after an error occurs
let fetchTimeout; // Flag to store the timeout ID

async function fetchAndCreateCSV() {
    
    // Toggle the fetching process
    isFetching = !isFetching;

    const fetchButton = document.getElementById('fetchButton');
    const loadingIndicator = document.getElementById('loadingIndicator');

    // If fetching has started
    if (isFetching) {
        // Update the UI for the fetching process
        fetchButton.textContent = 'Casting out!';
        fetchButton.style.backgroundColor = 'orange';
        fetchButton.disabled = true; // Enable the button

        // Empty results array
        const results = [];

        // Get config from config.js
        const apiURL = config.apiURL
        const apiKey = config.apiKey;
        const basicAuthCredentials = btoa(config.username + ':' + config.password);
        const paramId = config.paramId;
        const offset = config.offset;
        const count = config.count;

        // Check flag in groups.js to determine which groups to use (All or Sample Size)
        const groupsToUse = useTestGroups ? groupIDsTest : groupIDs;

        // Loop through groups
        const totalGroups = groupsToUse.length; // Total number of groups
        let currentGroup = 0;

        fetchTimeout = setTimeout(() => { // Store the timeout ID in the fetchTimeout variable
            fetchButton.textContent = 'Stop Fishing for Data';
            fetchButton.style.backgroundColor = 'red';
            fetchButton.disabled = false; // Enable the button
        }, 1000); // 1000 milliseconds equals 1 second
        
        let startTime = new Date(); // Store the start time before the loop
        let minutes;
        let seconds;

        for (const id of groupsToUse) {
            currentGroup++; // Increment the counter each time a group is processed
            const groupProgressPercent = ((currentGroup / totalGroups) * 100).toFixed(2); // Calculate the group progress percentage

            if (!isFetching) {
                break; // Exit loop if the fetching is stopped
            }

            console.log(`Fetching data for ID: ${id}`);
            
            try {
                if (!isFetching) {
                    break; // Exit loop if the fetching is stopped
                }

                // Get group data
                const groupUrl = `${apiURL}/${paramId}/group/${id}?offset=${offset}&count=${count}`;
                console.log(`Making request to: ${groupUrl}`);

                const groupResponse = await fetch(groupUrl, {
                    headers: {
                        'ApiKey': apiKey,
                        'accept' : 'application/json',
                        'Authorization': 'Basic ' + basicAuthCredentials
                    }
                });

                if (!groupResponse.ok) throw new Error('Group request failed. Please check your API credentials.');

                const groupData = await groupResponse.json();
                console.log('Group Data:', groupData);
                const totalSubgroups = groupData.numberOfSubgroups; // Get the total number of subgroups from the main group data

                // Get subgroups data
                const subgroupsURL = `${apiURL}/${paramId}/group/${id}/subgroups?offset=${offset}&count=${count}`;
                console.log(`Making request to: ${subgroupsURL}`);

                const subgroupsResponse = await fetch(subgroupsURL, {
                    headers: {
                        'ApiKey': apiKey,
                        'accept' : 'application/json',
                        'Authorization': 'Basic ' + basicAuthCredentials
                    }
                });

                if (!subgroupsResponse.ok) throw new Error('Second request failed. Please check your network connection.');

                const subgroupData = await subgroupsResponse.json();
                console.log('Subgroup Data:', subgroupData);

                if (subgroupData && subgroupData.elements && Array.isArray(subgroupData.elements)) {
                    let subgroupsCount = 0; // Counter for the number of subgroups processed

                    // Loop through subgroups
                    for (const subgroup of subgroupData.elements) {
                        subgroupsCount++; // Increment the counter each time a Subgroup is processed
                        const subgroupProgressPercent = ((subgroupsCount / totalSubgroups) * 100).toFixed(2); // Calculate the Subgroup progress percentage
    
                        if (!isFetching) {
                            break; // Exit loop if the fetching is stopped
                        }

                        // Calculate elapsed time
                        let now = new Date();
                        let elapsedTime = (now - startTime) / 1000; // time in seconds
                        minutes = Math.floor(elapsedTime / 60); // convert to minutes
                        seconds = Math.round(elapsedTime % 60); // get the remaining seconds

                        // Update the loading indicator with both subgroups and group progress
                        loadingIndicator.innerHTML = 
                        `Fishing for Data...Please wait. <br> Catching CSV Record <b>${currentGroup}</b> <br><br>` +
                        `Catching API Group 1 <b>${currentGroup}/${totalGroups}</b> (${groupProgressPercent}% Complete) <br>` +
                        `Catching API Group 2 <b>${subgroupsCount}/${totalSubgroups}</b> (${subgroupProgressPercent}% Complete) <br><br>` +
                        `Elapsed Time: ${minutes}m ${seconds}s`; // Displaying elapsed time
                        
                        // Get subgroup status data
                        const statusUrl = `${apiURL}/${paramId}/subgroup/${subgroup.id}/status?offset=${offset}&count=${count}`;
                        console.log(`Making request to: ${statusUrl}`);

                        const statusResponse = await fetch(statusUrl, {
                            headers: {
                                'ApiKey': apiKey,
                                'accept' : 'application/json',
                                'Authorization': 'Basic ' + basicAuthCredentials
                            }
                        });

                        if (!statusResponse.ok) throw new Error('Status request failed. Please check your network connection.');

                        const statusData = await statusResponse.json();
                        console.log('Status Data:', statusData);

                        // Format date
                        const epochCreated = new Date(subgroup.epochCreated);
                        const formattedDateCreated = epochCreated.toISOString().slice(0, 19).replace('T', ' ');

                        // Push data to results array
                        results.push({
                            "Group ID": id,
                            "Group Name": groupData.name,
                            "Company Name": groupData.companyName,
                            "Subgroup ID": subgroup.id,
                            "Date Created (UTC)": formattedDateCreated,
                            "Status Code": statusData.status,
                            "Service Status Data": statusData.subgroupStatus1,
                            "Service Status Voice": statusData.subgroupStatus2,
                            "Service Status SMS": statusData.subgroupStatus3
                        });
                    }
                } else {

                    console.log('No subgroups found for ID:', id);

                    // Add N/A data to results array if no subgroups are found
                    if (!results.some(result => result["Group ID"] === id)) {
                        results.push({
                            "Group ID": id,
                            "Group Name": groupData.name,
                            "Company Name": groupData.companyName,
                            "Subgroup ID": "N/A",
                            "Date Created (UTC)": "N/A",
                            "Status Code": "N/A",
                            "Status 1": "N/A",
                            "Status 2": "N/A",
                            "Status 3": "N/A"
                        });
                    }

                }

            } catch (error) {
                     
                clearTimeout(fetchTimeout); // Clear the timeout if an error occurs
                console.error(`Error occurred while processing ID ${id}:`, error);
                isFetching = false;
                isError = true;

                // Update the UI if an error occurred
                fetchButton.textContent = 'Error';
                fetchButton.style.backgroundColor = 'darkred';
                fetchButton.disabled = true; // Disable the button
                loadingIndicator.innerHTML = `An Error has occured! <br><br> <b>${error}</b> <br><br> • Check your console logs for more details. <br> • Troubleshoot and resolve the error. <br> • Refresh the page then try again.`;

            }
        }

        if (isFetching) {

            // Create CSV
            const csv = Papa.unparse(results);
            console.log('CSV Data:', csv);

            const now = new Date();
            const datetime = now.toISOString().slice(0,19).replace(/-/g, "").replace(/:/g, "").replace("T", "_");
            const fileName = `results_${datetime}.csv`;

            // Download CSV
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            fetchButton.textContent = 'Start Fishing for Data';
            fetchButton.style.backgroundColor = '#4CAF50';
            fetchButton.disabled = true; // Enable the button
            loadingIndicator.textContent = `Done Fishing! Total Time: ${minutes}m ${seconds}s`; // Display the final elapsed time

        }

        // Reset the UI after fetching is done or stopped
        let milliseconds;

        // Delay the UI reset if an error occurred
        if (isError) {
            milliseconds = 300000; // 300000 milliseconds equals 5 minutes
        } else {
            milliseconds = 1000; // 1000 milliseconds equals 1 seconds
        }
        
        setTimeout(() => {
            isFetching = false;
            isError = false;
            fetchButton.textContent = 'Start Fishing for Data';
            fetchButton.style.backgroundColor = '#4CAF50';
            fetchButton.disabled = false; // Enable the button
        }, milliseconds); // Set the delay

    } else {
        fetchButton.textContent = 'Reeling back in!';
        fetchButton.style.backgroundColor = 'blue';
        fetchButton.disabled = true; // Disable the button
        loadingIndicator.textContent = '';

        if (isFetching) {
            setTimeout(() => {
                location.reload(); // Refreshes the page after timeout
            }, 10000); // 10000 milliseconds equals 10 seconds
        }
        
    }
    
}
