/**
 * Test script for AI Timeline Generator
 * Tests the /api/ai/generate-timeline endpoint
 */

const DEPLOYMENT_URL = 'https://cdc325c8.researchtoolspy.pages.dev'

const testData = {
  behavior_title: "Voting in a U.S. Presidential Election",
  behavior_description: "The process of casting a vote in a United States presidential election, from registration through to submitting the ballot.",
  location_context: {
    geographic_scope: "national",
    specific_locations: ["United States"],
    location_notes: "Varies by state and county"
  },
  behavior_settings: {
    settings: ["in_person"],
    setting_details: "Primarily at designated polling places"
  },
  temporal_context: {
    frequency_pattern: "one_time",
    time_of_day: ["any_time"],
    duration_typical: "15-30 minutes",
    timing_notes: "Election day or early voting period"
  },
  complexity: "complex_process"
}

async function testTimelineGenerator() {
  console.log('🧪 Testing AI Timeline Generator...\n')
  console.log('📍 Endpoint:', `${DEPLOYMENT_URL}/api/ai/generate-timeline`)
  console.log('📦 Request data:', JSON.stringify(testData, null, 2))
  console.log('\n⏳ Calling API...\n')

  try {
    const startTime = Date.now()

    const response = await fetch(`${DEPLOYMENT_URL}/api/ai/generate-timeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    })

    const duration = Date.now() - startTime

    console.log(`⏱️  Response time: ${duration}ms`)
    console.log(`📊 Status: ${response.status} ${response.statusText}`)
    console.log(`📋 Headers:`, Object.fromEntries(response.headers.entries()))
    console.log('')

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Error Response:', errorText)

      try {
        const errorJson = JSON.parse(errorText)
        console.error('\n❌ Parsed Error:', JSON.stringify(errorJson, null, 2))
      } catch (e) {
        console.error('\n❌ Could not parse error as JSON')
      }

      process.exit(1)
    }

    const data = await response.json()

    console.log('✅ Success! Response received:')
    console.log(JSON.stringify(data, null, 2))
    console.log('')

    // Validate response structure
    if (!data.events) {
      console.error('❌ Missing "events" array in response')
      process.exit(1)
    }

    if (!Array.isArray(data.events)) {
      console.error('❌ "events" is not an array')
      process.exit(1)
    }

    if (data.events.length === 0) {
      console.error('⚠️  Warning: "events" array is empty')
    } else {
      console.log(`✅ Generated ${data.events.length} timeline events`)
    }

    // Validate event structure
    data.events.forEach((event, index) => {
      console.log(`\n📅 Event ${index + 1}:`)
      console.log(`  ID: ${event.id}`)
      console.log(`  Label: ${event.label}`)
      console.log(`  Time: ${event.time || 'N/A'}`)
      console.log(`  Location: ${event.location || 'N/A'}`)
      console.log(`  Description: ${event.description || 'N/A'}`)

      if (event.sub_steps && event.sub_steps.length > 0) {
        console.log(`  Sub-steps: ${event.sub_steps.length}`)
      }

      if (event.forks && event.forks.length > 0) {
        console.log(`  Forks: ${event.forks.length}`)
      }
    })

    console.log('\n✅ All tests passed!')
    process.exit(0)

  } catch (error) {
    console.error('\n❌ Test failed with error:')
    console.error(error)

    if (error.cause) {
      console.error('\nCause:', error.cause)
    }

    process.exit(1)
  }
}

// Run the test
testTimelineGenerator()
