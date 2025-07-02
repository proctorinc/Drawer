#!/bin/bash

# Function to show help message
show_help() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Generate random color combinations for daily prompts and create an SQL update file.

Options:
    --start DATE     Start date in YYYY-MM-DD format (default: today)
    --end DATE       End date in YYYY-MM-DD format (default: start date)
    --help          Show this help message

Examples:
    # Generate colors for today only
    $(basename "$0")

    # Generate colors for a specific date
    $(basename "$0") --start 2024-03-20

    # Generate colors for a date range
    $(basename "$0") --start 2024-03-20 --end 2024-03-25

The script will:
1. Generate three distinct colors for each day
2. Create an SQL file (update_colors.sql) with UPDATE statements
3. Print the generated colors for each day
EOF
    exit 0
}

# Function to validate date format (YYYY-MM-DD)
validate_date() {
    local date=$1
    if ! [[ $date =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        return 1
    fi
    # Convert to timestamp and back to validate
    if ! date -j -f "%Y-%m-%d" "$date" "+%Y-%m-%d" >/dev/null 2>&1; then
        return 1
    fi
    return 0
}

# Function to get next date
get_next_date() {
    local date=$1
    date -j -v+1d -f "%Y-%m-%d" "$date" "+%Y-%m-%d"
}

# Function to compare dates
compare_dates() {
    local date1=$1
    local date2=$2
    local ts1=$(date -j -f "%Y-%m-%d" "$date1" "+%s")
    local ts2=$(date -j -f "%Y-%m-%d" "$date2" "+%s")
    echo $((ts1 <= ts2))
}

# Parse command line arguments
start_date=$(date "+%Y-%m-%d")  # Default to today
end_date=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --start)
            start_date="$2"
            shift 2
            ;;
        --end)
            end_date="$2"
            shift 2
            ;;
        --help)
            show_help
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help to see usage information"
            exit 1
            ;;
    esac
done

# Validate dates
if ! validate_date "$start_date"; then
    echo "Error: Invalid start date format. Use YYYY-MM-DD"
    echo "Use --help to see usage information"
    exit 1
fi

if [ -n "$end_date" ] && ! validate_date "$end_date"; then
    echo "Error: Invalid end date format. Use YYYY-MM-DD"
    echo "Use --help to see usage information"
    exit 1
fi

# If no end date provided, use start date
if [ -z "$end_date" ]; then
    end_date=$start_date
fi

# Function to generate a random hex color
generate_color() {
    # Generate random RGB values ensuring good visibility
    # R: 40-255 (avoid too dark)
    # G: 40-255 (avoid too dark)
    # B: 40-255 (avoid too dark)
    R=$((40 + RANDOM % 216))
    G=$((40 + RANDOM % 216))
    B=$((40 + RANDOM % 216))
    printf "#%02x%02x%02x" $R $G $B
}

# Function to check if colors are too similar
are_colors_similar() {
    local color1=$1
    local color2=$2
    
    # Extract RGB components
    R1=$((16#${color1:1:2}))
    G1=$((16#${color1:3:2}))
    B1=$((16#${color1:5:2}))
    R2=$((16#${color2:1:2}))
    G2=$((16#${color2:3:2}))
    B2=$((16#${color2:5:2}))
    
    # Calculate color difference using a simple Euclidean distance
    diff=$(( (R1-R2)**2 + (G1-G2)**2 + (B1-B2)**2 ))
    
    # If difference is less than 10000, colors are too similar
    [ $diff -lt 10000 ]
}

# Function to generate three distinct colors
generate_three_colors() {
    local colors=()
    local max_attempts=100
    local attempts=0

    while [ ${#colors[@]} -lt 3 ] && [ $attempts -lt $max_attempts ]; do
        new_color=$(generate_color)
        too_similar=false
        
        for existing_color in "${colors[@]}"; do
            if are_colors_similar "$new_color" "$existing_color"; then
                too_similar=true
                break
            fi
        done
        
        if [ "$too_similar" = false ]; then
            colors+=("$new_color")
        fi
        
        attempts=$((attempts + 1))
    done

    # If we couldn't generate distinct colors, use a fallback set
    if [ ${#colors[@]} -ne 3 ]; then
        colors=("#FF6B6B" "#4ECDC4" "#45B7D1")
    fi

    echo "${colors[0]} ${colors[1]} ${colors[2]}"
}

# Create the SQL file
cat > update_colors.sql << EOF
-- Update colors for prompts from $start_date to $end_date
EOF

# Generate colors for each day
current_date=$start_date
while [ $(compare_dates "$current_date" "$end_date") -eq 1 ]; do
    colors=($(generate_three_colors))
    cat >> update_colors.sql << EOF
UPDATE daily_prompts 
SET colors = '["${colors[0]}", "${colors[1]}", "${colors[2]}"]'
WHERE day = '$current_date';
EOF
    echo "Generated colors for $current_date: ${colors[0]}, ${colors[1]}, ${colors[2]}"
    current_date=$(get_next_date "$current_date")
done

echo "SQL file created as: update_colors.sql" 