#!/bin/bash

# Function to create placeholder page
create_placeholder() {
  local framework=$1
  local page_type=$2
  local framework_display=$3
  local filepath=$4

  cat > "$filepath" << EOF
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ${framework}${page_type}Page() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            ${framework_display} - ${page_type}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            ${page_type} page for ${framework_display} framework
          </p>
        </div>
        ${page_type === 'List' ? `<Link to="/frameworks/${framework,,}/create">
          <Button>Create New</Button>
        </Link>` : `<Link to="/frameworks/${framework,,}">
          <Button variant="outline">Back to List</Button>
        </Link>`}
      </div>

      <Card>
        <CardContent className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            ${framework_display} ${page_type} page coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
EOF
}

# Create missing ACH pages
create_placeholder "Ach" "Create" "ACH" "src/pages/frameworks/ach/CreatePage.tsx"
create_placeholder "Ach" "Edit" "ACH" "src/pages/frameworks/ach/EditPage.tsx"

# Create missing DOTMLPF page
create_placeholder "Dotmlpf" "Edit" "DOTMLPF" "src/pages/frameworks/dotmlpf/EditPage.tsx"

# Create PEST pages
create_placeholder "Pest" "List" "PEST" "src/pages/frameworks/pest/ListPage.tsx"
create_placeholder "Pest" "Create" "PEST" "src/pages/frameworks/pest/CreatePage.tsx"
create_placeholder "Pest" "Edit" "PEST" "src/pages/frameworks/pest/EditPage.tsx"

# Create VRIO pages
create_placeholder "Vrio" "List" "VRIO" "src/pages/frameworks/vrio/ListPage.tsx"
create_placeholder "Vrio" "Create" "VRIO" "src/pages/frameworks/vrio/CreatePage.tsx"
create_placeholder "Vrio" "Edit" "VRIO" "src/pages/frameworks/vrio/EditPage.tsx"

# Create Trend pages
create_placeholder "Trend" "List" "Trend Analysis" "src/pages/frameworks/trend/ListPage.tsx"
create_placeholder "Trend" "Create" "Trend Analysis" "src/pages/frameworks/trend/CreatePage.tsx"
create_placeholder "Trend" "Edit" "Trend Analysis" "src/pages/frameworks/trend/EditPage.tsx"

# Create DIME pages
create_placeholder "Dime" "List" "DIME" "src/pages/frameworks/dime/ListPage.tsx"
create_placeholder "Dime" "Create" "DIME" "src/pages/frameworks/dime/CreatePage.tsx"
create_placeholder "Dime" "Edit" "DIME" "src/pages/frameworks/dime/EditPage.tsx"

# Create COG pages
create_placeholder "Cog" "List" "COG" "src/pages/frameworks/cog/ListPage.tsx"
create_placeholder "Cog" "Create" "COG" "src/pages/frameworks/cog/CreatePage.tsx"
create_placeholder "Cog" "Edit" "COG" "src/pages/frameworks/cog/EditPage.tsx"

# Create Stakeholder pages
create_placeholder "Stakeholder" "List" "Stakeholder Analysis" "src/pages/frameworks/stakeholder/ListPage.tsx"
create_placeholder "Stakeholder" "Create" "Stakeholder Analysis" "src/pages/frameworks/stakeholder/CreatePage.tsx"
create_placeholder "Stakeholder" "Edit" "Stakeholder Analysis" "src/pages/frameworks/stakeholder/EditPage.tsx"

# Create Starbursting pages
create_placeholder "Starbursting" "List" "Starbursting" "src/pages/frameworks/starbursting/ListPage.tsx"
create_placeholder "Starbursting" "Create" "Starbursting" "src/pages/frameworks/starbursting/CreatePage.tsx"
create_placeholder "Starbursting" "Edit" "Starbursting" "src/pages/frameworks/starbursting/EditPage.tsx"

# Create Fundamental Flow pages
create_placeholder "FundamentalFlow" "List" "Fundamental Flow" "src/pages/frameworks/fundamental-flow/ListPage.tsx"
create_placeholder "FundamentalFlow" "Create" "Fundamental Flow" "src/pages/frameworks/fundamental-flow/CreatePage.tsx"
create_placeholder "FundamentalFlow" "Edit" "Fundamental Flow" "src/pages/frameworks/fundamental-flow/EditPage.tsx"

# Create Behavior pages
create_placeholder "Behavior" "List" "Behavior Analysis" "src/pages/frameworks/behavior/ListPage.tsx"
create_placeholder "Behavior" "Create" "Behavior Analysis" "src/pages/frameworks/behavior/CreatePage.tsx"
create_placeholder "Behavior" "Edit" "Behavior Analysis" "src/pages/frameworks/behavior/EditPage.tsx"

# Create Causeway pages
create_placeholder "Causeway" "List" "Causeway" "src/pages/frameworks/causeway/ListPage.tsx"
create_placeholder "Causeway" "Edit" "Causeway" "src/pages/frameworks/causeway/EditPage.tsx"

# Create Surveillance pages
create_placeholder "Surveillance" "List" "Surveillance" "src/pages/frameworks/surveillance/ListPage.tsx"
create_placeholder "Surveillance" "Create" "Surveillance" "src/pages/frameworks/surveillance/CreatePage.tsx"
create_placeholder "Surveillance" "Edit" "Surveillance" "src/pages/frameworks/surveillance/EditPage.tsx"

# Create Deception pages
create_placeholder "Deception" "List" "Deception Detection" "src/pages/frameworks/deception/ListPage.tsx"
create_placeholder "Deception" "Create" "Deception Detection" "src/pages/frameworks/deception/CreatePage.tsx"
create_placeholder "Deception" "Edit" "Deception Detection" "src/pages/frameworks/deception/EditPage.tsx"

echo "All placeholder pages created!"