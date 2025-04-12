import RPi.GPIO as GPIO
import time
 

Pins = { 'ACDC': 27, 'X10': 4 ,  'J1': 22 , 'J2': 6 }

def setup():
  GPIO.setmode(GPIO.BCM)       # Numbers GPIOs by chip numbering scheme
  for pin in Pins:
    GPIO.setup(Pins[pin], GPIO.OUT)   # Set LedPin's mode is output
    GPIO.output(Pins[pin], GPIO.LOW) 

def blink():
  while True:
    for pin in Pins:
        GPIO.output(Pins[pin], GPIO.HIGH)  # led on
        print("*****Input pin state (Output HIGH) ", pin, "*****\n")
        time.sleep(2)
        GPIO.output(Pins[pin], GPIO.LOW) # led off
        print("*****Input pin state (Output LOW) ", pin, "*****\n")
        time.sleep(2)
 
def destroy():
    for pin in Pins:
        GPIO.output(Pins[pin], GPIO.LOW)   # led off
        GPIO.setup(Pins[pin], GPIO.IN, pull_up_down=GPIO.PUD_DOWN)  # Set LedPin's mode is input
    GPIO.cleanup()                  # Release resource
 
if __name__ == '__main__':     # Program start from here
  print('To read output correctly, jumper pin 13 (bcm27) to pin 19(bcm6)')
  print('Press Ctrl-C to exit') 
  setup()
  try:
    blink()
  except KeyboardInterrupt:  # When 'Ctrl+C' is pressed, the child program destroy() will be  executed.
    destroy()