attempt_counter=0
max_attempts=200

running_count=$(architect dev:list | grep running | wc -l)

while [ ! $running_count -eq 5 ]
do
    if [ ${attempt_counter} -eq ${max_attempts} ];then
      echo "Max attempts reached"
      exit 1
    fi

    printf '.'
    attempt_counter=$(($attempt_counter+1))
    sleep 10
    running_count=$(architect dev:list | grep running | wc -l)
done

echo "Containers are started"

READY_TEXT="Ready on port"
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
