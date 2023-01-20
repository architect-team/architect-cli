attempt_counter=0
max_attempts=100

running_count=$(./bin/dev dev:list | grep running | wc -l)

while [ ! $running_count -eq 6 ]
do
    if [ ${attempt_counter} -eq ${max_attempts} ];then
      echo "Max attempts reached"
      exit 1
    fi

    printf "($(echo $running_count | sed 's/ *$//g')/6) Services Running..\n"
    attempt_counter=$(($attempt_counter+1))
    sleep 10
    running_count=$(./bin/dev dev:list | grep running | wc -l)
done

echo "Containers are started"

READY_TEXT="Ready on port\|Listening on port\|database system is ready"
MATCH=1
while [ ${MATCH} -eq 1 ]
do
    tail -40 ./tmp.txt | grep "$READY_TEXT"
    if [ $? -eq 0 ]; then
      MATCH=0
    else
      echo Not Found
      sleep 1s
    fi
done
echo "Containers are ready"
