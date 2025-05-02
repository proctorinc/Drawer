DB_NAME=drawer

echo "updating pg db schema..."
if psql -d $DB_NAME -a -f schema.sql
then
    echo "done"
else
    exit 1
fi
