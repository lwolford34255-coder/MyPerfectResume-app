/*
I remembered the slide up/down method from our registration form assignments in class.
the AI helped me expand that idea into a "Dashboard" feel where sections swap 
without the page refreshing, keeping the app feeling like one smooth tool.
*/
function showSection(strId){
    //jQuery to find any section that isn't hidden, slide it up, then slide the new section down.
    $('.section-page:not(.d-none)').slideUp(400, function(){
        $(this).addClass('d-none')
        $(`#${strId}`).hide().removeClass('d-none').slideDown(400)
    })
    
    if (strId === 'divHome'){
        document.title = "MyPerfectResume - Home" //Home screen
    }
    if (strId === 'divJobs'){
        document.title = "MyPerfectResume - Experience"
        loadJobs() //Refresh the list of jobs when this section is entered.
    }
    if (strId === 'divExtras'){
        document.title = "MyPerfectResume - Skills"
        loadExtras() //Refresh the list of skills when this section is entered.
    }
    if (strId === 'divBuild'){
        document.title = "MyPerfectResume - Builder"
        generateResume() //Compile the final resume preview.
    }
}

//Resets the input fields and launches the Bootstrap modal for adding a new job.
function openJobModal(){
    document.querySelector('#txtCompany').value = ""
    document.querySelector('#txtRole').value = ""
    document.querySelector('#txtDescription').value = ""
    
    const myModal = new bootstrap.Modal(document.getElementById('modalJob'))
    myModal.show()
}

//Shows the Attribution for the libraries I used
function showAttribution(){
    const attributionModal = new bootstrap.Modal(document.getElementById('modalAttribution'))
    attributionModal.show()
}

//This calls the backend route to get Gemini to rewrite the resume text.
async function getAISuggestion(){
    let strContent = document.querySelector('#txtDescription').value.trim()

    //Prevent sending empty prompts to the API.
    if (strContent.length < 1){
        Swal.fire({ title: "Wait!", text: "Add a few more details first.", icon: "warning" })
        return
    }

    //Show a loading spinner so the user knows the AI is processing.
    Swal.fire({ 
        title: 'Gemini is thinking...', 
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading() } 
    })

    try {
        //Send the user's text to the server.
        const response = await fetch('/api/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ strContent: strContent }) 
        })

        const data = await response.json()
        if (data.suggestion){
            Swal.close()
            //Replace the text with the AI's new version.
            document.querySelector('#txtDescription').value = data.suggestion
        }
    } catch (err){
        Swal.fire("AI Error", "Could not reach the AI server.", "error")
    }
}

//Takes the values from the modal and saves them to the SQLite database.
function saveJob(){
    let strCompany = document.querySelector('#txtCompany').value.trim()
    let strRole = document.querySelector('#txtRole').value.trim()
    let strDesc = document.querySelector('#txtDescription').value.trim()

    //Makes sure company and role are entered
    if (!strCompany || !strRole){
        Swal.fire({ title: "Error", text: "Please enter Company and Role.", icon: "error" })
        return
    }

    //Send the new job experience back to the database
    fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strCompany, strRole, strDesc })
    })
    .then(res => res.json())
    .then(() => {
        Swal.fire({ title: "Saved!", icon: "success", timer: 1000, showConfirmButton: false })
        bootstrap.Modal.getInstance(document.getElementById('modalJob')).hide()
        loadJobs() //Refresh the list so the new job appears immediately.
    })
}

// --- AI-Assisted Implementation: Selection System ---
/*
After bouncing ideas off the AI for a way to let users "pick and choose" content,
we landed on this checkbox-based filtering system. 
I provided the HTML structure, and the AI suggested using 'data-' attributes 
to store the actual object data directly on the card.
*/
function loadJobs(){
    fetch('/api/jobs')
        .then(response => response.json())
        .then(arrJobs => {
            let strHTML = ""
            if (arrJobs.length > 0){
                arrJobs.forEach(objJob => {
                    /*
                    The AI explained that stringifying the object into a data attribute 
                    makes it way easier to grab later when we 'build' the resume 
                    without having to ping the database a second time. It's basically very
                    similar to what we did in class when we were learning about tables, just
                    used in a different way.
                    */
                    strHTML += `
                        <div class="card mb-3 shadow-sm border-secondary job-item" data-job='${JSON.stringify(objJob)}'>
                            <div class="card-body">
                                <div class="d-flex justify-content-between">
                                    <h3 class="h5 fw-bold mb-1">${objJob.company}</h3>
                                    <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteJob(${objJob.id})" aria-label="Delete ${objJob.company} experience">
                                        <i class="bi bi-trash" aria-hidden="true"></i>
                                    </button>
                                </div>
                                <h4 class="h6 text-primary mb-2">${objJob.role}</h4>
                                <p class="small text-muted mb-3" style="white-space: pre-line;">${objJob.description || ''}</p>
                                <div class="form-check">
                                    <!-- I had to finagle the AI's logic here to make sure each 
                                         checkbox had a unique ID so the label would work correctly. -->
                                    <input class="form-check-input chk-resume" type="checkbox" value="${objJob.id}" id="chkJob${objJob.id}">
                                    <label class="form-check-label fw-bold" for="chkJob${objJob.id}">Include on Resume</label>
                                </div>
                            </div>
                        </div>`
                })
            }

            //If there are no jobs, say that there are no experiences currently entered
            if (arrJobs.length === 0) {
                strHTML = '<p class="text-center text-muted py-4">No experiences found.</p>'
            }
            document.querySelector("#divJobList").innerHTML = strHTML
        });
}

//Asks for confirmation before calling the DELETE route on the server.
function deleteJob(intId){
    Swal.fire({
        title: "Delete this job?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        confirmButtonText: "Yes, delete it!"
    }).then((result) => {
        if (result.isConfirmed) {
            fetch(`/api/jobs/${intId}`, { method: 'DELETE' }).then(() => loadJobs())
        }
    })
}

//Saves skills/awards. Same as for jobs, just for skills/awards
function saveExtra() {
    let strType = document.querySelector('#selType').value
    let strContent = document.querySelector('#txtExtraContent').value.trim()

    //See if content is empty
    if (strContent === ""){
        return
    }

    //Send new info back to the database
    fetch('/api/extras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strType, strContent })
    })
    .then(res => res.json())
    .then(() => {
        document.querySelector('#txtExtraContent').value = ""
        loadExtras()
    })
}

//Same as loadJobs, just for the extras
function loadExtras(){
    fetch('/api/extras')
        .then(res => res.json())
        .then(arrExtras => {
            let strHTML = ""
            arrExtras.forEach(obj => {
                strHTML += `
                    <div class="col-md-6 mb-3 extra-item" data-extra='${JSON.stringify(obj)}'>
                        <div class="card p-3 border-secondary h-100 bg-white text-dark shadow-sm">
                            <div class="form-check">
                                <input class="form-check-input chk-extra" type="checkbox" value="${obj.id}" id="chkExtra${obj.id}">
                                <label class="form-check-label ms-2" for="chkExtra${obj.id}">
                                    <span class="badge bg-primary me-2">${obj.type}</span> ${obj.content}
                                </label>
                                <button class="btn btn-sm btn-link text-danger float-end p-0" onclick="deleteExtra(${obj.id})" aria-label="Delete this ${obj.type}">
                                    <i class="bi bi-trash" aria-hidden="true"></i>
                                </button>
                            </div>
                        </div>
                    </div>`;
            })
            if (arrExtras.length === 0) {
                strHTML = '<p class="text-muted">No entries yet.</p>'
            }
            document.querySelector("#divExtraList").innerHTML = strHTML
        })
}

//Delete an extra
function deleteExtra(intId) {
    fetch(`/api/extras/${intId}`, { method: 'DELETE' }).then(() => loadExtras())
}


/*
This part was the task the AI helped me simplify.
Instead of complex arrays, the AI taught me to just query
for any checkbox that is currently ':checked'.
*/
function generateResume(){
    const arrSelectedJobs = [];
    /*
    The AI showed me how to use .querySelectorAll with the :checked pseudo-class.
    This loops through only the cards the user explicitly wanted.
    */
    document.querySelectorAll('.chk-resume:checked').forEach(chk => {
        /*
        I learned that I can use .closest() to go from the checkbox up to the 
        card container to grab that 'data-job' attribute we stored earlier.
        */
        arrSelectedJobs.push(JSON.parse(chk.closest('.job-item').getAttribute('data-job')))
    })

    const arrSelectedExtras = [];
    document.querySelectorAll('.chk-extra:checked').forEach(chk => {
        arrSelectedExtras.push(JSON.parse(chk.closest('.extra-item').getAttribute('data-extra')))
    })

    let strResumeHTML = ""

    //Experience Section: Building the professional headers and bullet points.
    strResumeHTML += `<h2 class="text-uppercase border-bottom border-dark border-3 mb-4">Experience</h2>`
    if (arrSelectedJobs.length === 0){
        strResumeHTML += "<p class='text-center text-muted py-5'>Select experiences to preview.</p>"
    } else {
        arrSelectedJobs.forEach(job => {
            strResumeHTML += `
                <div class="mb-4">
                    <div class="d-flex justify-content-between align-items-end">
                        <h3 class="h4 fw-bold mb-0 text-uppercase">${job.company}</h3>
                        <span class="fst-italic text-secondary fs-5">${job.role}</span>
                    </div>
                    <p class="mt-2 fs-5" style="white-space: pre-line;">${job.description}</p>
                </div>`
        })
    }

    //Extras Section: Only shows up if something is selected.
    if (arrSelectedExtras.length > 0){
        strResumeHTML += `<h2 class="text-uppercase border-bottom border-dark border-3 mb-4 mt-5">Skills & Awards</h2><ul class="row list-unstyled">`
        arrSelectedExtras.forEach(extra => {
            strResumeHTML += `<li class="col-6 mb-1 fs-5"><strong>${extra.type}:</strong> ${extra.content}</li>`
        })
        strResumeHTML += `</ul>`
    }

    //Put the final string of HTML into our resume paper div.
    document.querySelector("#divResumeContent").innerHTML = strResumeHTML
}

//Start the app on the Home section when the page loads.
$(document).ready(function(){
    showSection('divHome')
})