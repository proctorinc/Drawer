#!/bin/bash

# Check if SQL file exists
SQL_FILE="./update_colors.sql"
if [ ! -f "$SQL_FILE" ]; then
    echo "Error: SQL file not found at $SQL_FILE"
    echo "Please run update_daily_colors.sh first to generate the SQL file"
    exit 1
fi

# Read the SQL file
SQL_CONTENT=$(cat "$SQL_FILE")

# Create the HTML file with the SQL content embedded
cat > preview_colors.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Color Combinations Preview</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .color-combo {
            display: flex;
            margin-bottom: 20px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .color {
            flex: 1;
            height: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
            font-family: monospace;
            font-size: 14px;
        }
        .date {
            padding: 10px;
            background: #333;
            color: white;
            font-family: monospace;
            font-size: 14px;
            display: flex;
            align-items: center;
        }
    </style>
</head>
<body>
    <h1>Color Combinations Preview</h1>
    <div id="combos"></div>

    <script>
        // Parse the SQL file content
        const sqlContent = \`$SQL_CONTENT\`;

        console.log(sqlContent);

        // Extract color combinations and dates
        const combos = [];
        const regex = /colors = '\[(.*?)\]'.*?WHERE day = '(.*?)'/g;
        let match;

        console.log(combos)
        
        while ((match = regex.exec(sqlContent)) !== null) {
            const colors = match[1].split(', ').map(c => c.replace(/"/g, ''));
            const date = match[2];
            combos.push({ date, colors });
        }

        // Create HTML
        const container = document.getElementById('combos');
        combos.forEach(combo => {
            const div = document.createElement('div');
            div.className = 'color-combo';
            
            const dateDiv = document.createElement('div');
            dateDiv.className = 'date';
            dateDiv.textContent = combo.date;
            div.appendChild(dateDiv);

            combo.colors.forEach(color => {
                const colorDiv = document.createElement('div');
                colorDiv.className = 'color';
                colorDiv.style.backgroundColor = color;
                colorDiv.textContent = color;
                div.appendChild(colorDiv);
            });

            container.appendChild(div);
        });
    </script>
</body>
</html>
EOF

echo "Preview file created: preview_colors.html"
echo "Open this file in your browser to see the color combinations" 