<?php

require_once('Text.php');

class DojoParameters
{
  private $dojo;
  private $package;
  
  public function __construct($dojo, $package)
  {
    $this->dojo = $dojo;
    $this->package = $package;
  }
  
  public function buildParameters($start_line, $start, $end_line, $end_position)
  {
    $paren_balance = 0;
    $block_balance = 0;
    $bracket_balance = 0;

    $lines = Text::chop($this->package->getSource(), $start_line, $start, $end_line, $end_position, true);
    foreach ($lines as $line_number => $line) {
      if (trim($line) == '') {
        $start = 0;
        continue;
      }
      
      for ($i = $start; $i < strlen($line); $i++) {
        $start = 0;
        if (!isset($parameter)) {
          $parameter = new DojoParameter();
          if ($i + 1 < strlen($line)) {
            $parameter->setStart($line_number, $i + 1);
          }
          elseif(strlen($line) == 1) {
          	$parameter->setStart($line_number, 0);
          }
          else {
            $parameter->setStart($line_number + 1, 0);
          }
        }
        
        $char = $line{$i};
        if ($char == '(') {
          ++$paren_balance;
        }
        elseif ($char == ')') {
          --$paren_balance;
        }
        elseif ($char == '{') {
          ++$block_balance;
        }
        elseif ($char == '}') {
          --$block_balance;
        }
        elseif ($char == '[') {
          ++$bracket_balance;
        }
        elseif ($char == ']') {
          --$bracket_balance;
        }
        
        if (!$paren_balance && !$block_balance && !$bracket_balance && $char == ',') {
          $parameter->setEnd($line_number, $i - 1);
          $this->parameters[] = $parameter;
          unset($parameter);
        }
      }
    }
    
    if ($parameter) {
      $parameter->setEnd($this->parameter_end[0], $this->parameter_end[1] - 1);
      $this->parameters[] = $parameter;
    }
    
    return $this->parameters;
  }
}

?>