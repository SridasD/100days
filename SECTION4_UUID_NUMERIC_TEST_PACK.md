# Section 4 UUID and Numeric Compatibility Test Pack

Use this pack to complete Section 4 in the release checklist.

## A. Collect Sample IDs from DB

Run these queries and keep one UUID and one numeric ID for each entity.

Department samples (master_secretary)
SELECT sec_id AS numeric_id, public_id AS uuid_id, secretary_name
FROM hdp.master_secretary
WHERE public_id IS NOT NULL
ORDER BY sec_id
LIMIT 5;

Project samples (master_projects)
SELECT project_id AS numeric_id, public_id AS uuid_id, project_name
FROM hdp.master_projects
WHERE public_id IS NOT NULL
ORDER BY project_id
LIMIT 5;

Sector samples (master_sector)
SELECT sector_id AS numeric_id, public_id AS uuid_id, sector_name
FROM hdp.master_sector
WHERE public_id IS NOT NULL
ORDER BY sector_id
LIMIT 5;

District samples (master_district)
SELECT district_id AS numeric_id, public_id AS uuid_id, district_name
FROM hdp.master_district
WHERE public_id IS NOT NULL
ORDER BY district_id
LIMIT 5;

## B. API Checks

Replace placeholders with IDs collected above.
Expected result during transition: both UUID and numeric requests resolve successfully.

Departments
GET /api/public/departments/{department_uuid}
GET /api/public/departments/{department_numeric}

Projects
GET /api/public/projects/{project_uuid}
GET /api/public/projects/{project_numeric}

Sectors
GET /api/public/sectors/{sector_uuid}
GET /api/public/sectors/{sector_numeric}

Sector Departments
GET /api/public/sectors/{sector_uuid}/departments
GET /api/public/sectors/{sector_numeric}/departments

Districts
GET /api/public/districts/{district_uuid}
GET /api/public/districts/{district_numeric}

Important:

- District endpoints are OSD-protected by design.
- Anonymous requests may return `401`/`403` and should be validated under Section 2 (Role-Based Access Regression).
- For Section 4 compatibility pass, execute district UUID/numeric checks with an authenticated OSD session.

## C. Pass Criteria

Mark pass only if all conditions are true:

1. Request returns successful response for UUID and numeric forms.
2. Response data points to the same entity in both forms.
3. No schema or runtime errors in server logs.
4. Public pages using these IDs render expected data.

## D. Evidence to Capture

For each endpoint pair:

1. Request URL used for UUID.
2. Request URL used for numeric ID.
3. Response status codes.
4. One key field proving entity match (example: project_name, secretary_name).

## E. Map Results into Checklist

Update these fields in the release checklist:

1. Section 4 checkboxes.
2. Sample IDs used.
3. Evidence links or references.

## F. PowerShell Quick Run

Use these commands in PowerShell after replacing sample IDs.

Set base URL and IDs:

$BASE = "http://localhost:3000"

$DepartmentUuid = "45778621-a3d3-4315-9099-c5f1cb727850"
$DepartmentNumeric = "1"

$ProjectUuid = "88f9d622-e7db-45aa-b41e-a0d35354fd71"
$ProjectNumeric = "1"

$SectorUuid = "0d05e9ca-139e-4f47-b46b-74a21286eac1"
$SectorNumeric = "1"

$DistrictUuid = "c8dab74a-48ea-4779-8602-6ef079c4bc98"
$DistrictNumeric = "1"

Helper function (copy code only, not this label text):

function Test-Endpoint {
param(
[string]$Path,
		[string]$Label
)

    $url = "$BASE$Path"
    try {
    	$res = Invoke-WebRequest -Uri $url -Method GET
    	$body = $res.Content | ConvertFrom-Json
    	$sample = @(
    		$body.projectName,
    		$body.departmentName,
    		$body.districtName,
    		$body.sectorName,
    		'n/a'
    	) | Where-Object { $_ } | Select-Object -First 1

    	[PSCustomObject]@{
    		Label = $Label
    		Url = $url
    		StatusCode = [int]$res.StatusCode
    		Ok = $true
    		SampleField = $sample
    	}
    }
    catch {
    	$status = -1
    	if ($_.Exception.Response) {
    		try { $status = [int]$_.Exception.Response.StatusCode } catch { $status = -1 }
    	}

    	[PSCustomObject]@{
    		Label = $Label
    		Url = $url
    		StatusCode = $status
    		Ok = $false
    		SampleField = 'error'
    	}
    }

}

Run tests:

$results = @(
	Test-Endpoint "/api/public/departments/$DepartmentUuid" "departments-uuid"
Test-Endpoint "/api/public/departments/$DepartmentNumeric" "departments-numeric"
	Test-Endpoint "/api/public/projects/$ProjectUuid" "projects-uuid"
Test-Endpoint "/api/public/projects/$ProjectNumeric" "projects-numeric"
	Test-Endpoint "/api/public/sectors/$SectorUuid" "sectors-uuid"
Test-Endpoint "/api/public/sectors/$SectorNumeric" "sectors-numeric"
	Test-Endpoint "/api/public/sectors/$SectorUuid/departments" "sectors-departments-uuid"
Test-Endpoint "/api/public/sectors/$SectorNumeric/departments" "sectors-departments-numeric"
	Test-Endpoint "/api/public/districts/$DistrictUuid" "districts-uuid"
Test-Endpoint "/api/public/districts/$DistrictNumeric" "districts-numeric"
)

$results | Format-Table -AutoSize
$results | ConvertTo-Json -Depth 4

Expected:

1. All rows have Ok = True.
2. StatusCode is success for UUID and numeric rows.
3. UUID and numeric rows per entity point to the same record semantics.

District exception:

- If run anonymously, district rows can correctly return `401`/`403`.
- Re-run district rows with OSD-authenticated session for Section 4 pass evidence.

## G. Fillable Result Matrix

| Endpoint Pair       | UUID Status | Numeric Status | Same Entity | Pass/Fail | Evidence |
| ------------------- | ----------: | -------------: | ----------- | --------- | -------- |
| Departments         |             |                |             |           |          |
| Projects            |             |                |             |           |          |
| Sectors             |             |                |             |           |          |
| Sectors Departments |             |                |             |           |          |
| Districts           |             |                |             |           |          |
